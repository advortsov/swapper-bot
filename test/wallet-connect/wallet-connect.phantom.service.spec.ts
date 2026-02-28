import type { ConfigService } from '@nestjs/config';
import bs58 from 'bs58';
import { Buffer } from 'node:buffer';
import nacl from 'tweetnacl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { IAggregator } from '../../src/aggregators/interfaces/aggregator.interface';
import type { SolanaChain } from '../../src/chains/solana/solana.chain';
import type { MetricsService } from '../../src/metrics/metrics.service';
import { WalletConnectPhantomService } from '../../src/wallet-connect/wallet-connect.phantom.service';
import { WalletConnectSessionStore } from '../../src/wallet-connect/wallet-connect.session-store';

function encryptPayload(
  payload: object,
  sharedSecret: Uint8Array,
): { nonce: string; data: string } {
  const nonce = nacl.randomBytes(24);
  const encryptedPayload = nacl.box.after(
    Buffer.from(JSON.stringify(payload)),
    nonce,
    sharedSecret,
  );

  return {
    nonce: bs58.encode(nonce),
    data: bs58.encode(encryptedPayload),
  };
}

describe('WalletConnectPhantomService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('должен проводить Solana swap через Phantom deeplink flow', async () => {
    const configValues: Record<string, string> = {
      WC_PROJECT_ID: 'wc-project-id',
      APP_PUBLIC_URL: 'https://1303118-cr22992.tw1.ru',
      TELEGRAM_BOT_TOKEN: 'telegram-token',
      SWAP_TIMEOUT_SECONDS: '300',
      SWAP_SLIPPAGE: '0.5',
      EXPLORER_URL_SOLANA: 'https://solscan.io/tx/',
    };
    const configService: Pick<ConfigService, 'get'> = {
      get: (key: string) => configValues[key],
    };
    const metricsService: Pick<MetricsService, 'incrementSwapRequest'> = {
      incrementSwapRequest: vi.fn(),
    };
    const aggregator: IAggregator = {
      name: 'jupiter',
      supportedChains: ['solana'],
      getQuote: vi.fn(),
      buildSwapTransaction: vi.fn().mockResolvedValue({
        kind: 'solana',
        to: '',
        data: '',
        value: '0',
        serializedTransaction: Buffer.from('unsigned-solana-transaction').toString('base64'),
        lastValidBlockHeight: 123_456,
      }),
      healthCheck: vi.fn(),
    };
    const sessionStore = new WalletConnectSessionStore();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
    });
    vi.stubGlobal('fetch', fetchMock);

    const solanaChain: Pick<SolanaChain, 'broadcastSignedTransaction'> = {
      broadcastSignedTransaction: vi.fn().mockResolvedValue('solana-signature'),
    };
    const service = new WalletConnectPhantomService(
      configService as ConfigService,
      sessionStore,
      metricsService as MetricsService,
      solanaChain as SolanaChain,
    );
    (
      service as unknown as {
        aggregators: readonly IAggregator[];
      }
    ).aggregators = [aggregator];

    const session = await service.createSession({
      userId: '12345',
      swapPayload: {
        chain: 'solana',
        aggregatorName: 'jupiter',
        sellTokenAddress: 'So11111111111111111111111111111111111111112',
        buyTokenAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        sellAmountBaseUnits: '1000000000',
        sellTokenDecimals: 9,
        buyTokenDecimals: 6,
        slippagePercentage: 0.5,
      },
    });

    const sessionUrl = new URL(session.uri);
    const sessionId = sessionUrl.searchParams.get('sessionId');

    expect(sessionUrl.origin).toBe('https://1303118-cr22992.tw1.ru');
    expect(sessionUrl.pathname).toBe('/phantom/connect');
    expect(sessionId).toBeTruthy();

    const connectUrl = service.getPhantomConnectUrl(sessionId ?? '');
    const storedSession = sessionStore.get(sessionId ?? '');
    const phantomState = storedSession?.phantom;

    expect(connectUrl).toContain('https://phantom.com/ul/v1/connect');
    expect(phantomState?.dappEncryptionPublicKey).toBeTruthy();
    expect(phantomState?.dappEncryptionSecretKey).toBeTruthy();

    const phantomKeyPair = nacl.box.keyPair();
    const sharedSecret = nacl.box.before(
      bs58.decode(phantomState?.dappEncryptionPublicKey ?? ''),
      phantomKeyPair.secretKey,
    );
    const connectPayload = encryptPayload(
      {
        public_key: 'wallet-public-key',
        session: 'phantom-session-token',
      },
      sharedSecret,
    );

    const signUrl = await service.handleConnectCallback({
      sessionId: sessionId ?? '',
      phantom_encryption_public_key: bs58.encode(phantomKeyPair.publicKey),
      nonce: connectPayload.nonce,
      data: connectPayload.data,
    });

    expect(aggregator.buildSwapTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        chain: 'solana',
        fromAddress: 'wallet-public-key',
      }),
    );
    expect(signUrl).toContain('https://phantom.com/ul/v1/signTransaction');

    const signPayload = encryptPayload(
      {
        transaction: bs58.encode(Uint8Array.from([1, 2, 3, 4])),
      },
      sharedSecret,
    );
    const result = await service.handleSignCallback({
      sessionId: sessionId ?? '',
      nonce: signPayload.nonce,
      data: signPayload.data,
    });

    expect(solanaChain.broadcastSignedTransaction).toHaveBeenCalledWith(
      Uint8Array.from([1, 2, 3, 4]),
      123_456,
    );
    expect(result).toEqual({
      explorerUrl: 'https://solscan.io/tx/solana-signature',
      transactionHash: 'solana-signature',
    });
    expect(fetchMock).toHaveBeenCalled();
    expect(sessionStore.get(sessionId ?? '')).toBeNull();
  });
});
