import type { ConfigService } from '@nestjs/config';
import bs58 from 'bs58';
import { Buffer } from 'node:buffer';
import nacl from 'tweetnacl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { IAggregator } from '../../src/aggregators/interfaces/aggregator.interface';
import type { SolanaChain } from '../../src/chains/solana/solana.chain';
import type { SwapExecutionAuditService } from '../../src/swap/swap-execution-audit.service';
import { WalletConnectPhantomLinksService } from '../../src/wallet-connect/wallet-connect.phantom-links.service';
import { WalletConnectPhantomMessagingService } from '../../src/wallet-connect/wallet-connect.phantom-messaging.service';
import { WalletConnectPhantomStateService } from '../../src/wallet-connect/wallet-connect.phantom-state.service';
import { WalletConnectPhantomTransactionService } from '../../src/wallet-connect/wallet-connect.phantom-transaction.service';
import { WalletConnectPhantomService } from '../../src/wallet-connect/wallet-connect.phantom.service';
import { WalletConnectSessionStore } from '../../src/wallet-connect/wallet-connect.session-store';
import { createDisabledFeeConfig } from '../support/fee.fixtures';

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
    const auditService: Pick<SwapExecutionAuditService, 'markError' | 'markSuccess'> = {
      markError: vi.fn().mockResolvedValue(undefined),
      markSuccess: vi.fn().mockResolvedValue(undefined),
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
    const sessionStore = new WalletConnectSessionStore(configService as ConfigService);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
    });
    vi.stubGlobal('fetch', fetchMock);

    const solanaChain: Pick<SolanaChain, 'broadcastSignedTransaction'> = {
      broadcastSignedTransaction: vi.fn().mockResolvedValue('solana-signature'),
    };
    const stateService = new WalletConnectPhantomStateService(
      configService as ConfigService,
      sessionStore,
    );
    const linksService = new WalletConnectPhantomLinksService(
      configService as ConfigService,
      sessionStore,
    );
    const messagingService = new WalletConnectPhantomMessagingService(
      configService as ConfigService,
    );
    const transactionService = new WalletConnectPhantomTransactionService(
      configService as ConfigService,
      solanaChain as SolanaChain,
      [aggregator],
    );
    const service = new WalletConnectPhantomService(
      linksService,
      messagingService,
      stateService,
      transactionService,
    );
    (
      service as unknown as {
        sessionStore: WalletConnectSessionStore;
        swapExecutionAuditService: SwapExecutionAuditService;
      }
    ).sessionStore = sessionStore;
    (
      service as unknown as {
        sessionStore: WalletConnectSessionStore;
        swapExecutionAuditService: SwapExecutionAuditService;
      }
    ).swapExecutionAuditService = auditService as SwapExecutionAuditService;
    (service as unknown as Record<string, unknown>)['transactionTrackerService'] = {
      track: vi.fn().mockResolvedValue(undefined),
    };

    const session = await service.createSession({
      userId: '12345',
      swapPayload: {
        intentId: 'intent-id',
        executionId: 'execution-id',
        chain: 'solana',
        aggregatorName: 'jupiter',
        fromSymbol: 'SOL',
        toSymbol: 'USDC',
        sellTokenAddress: 'So11111111111111111111111111111111111111112',
        buyTokenAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        sellAmountBaseUnits: '1000000000',
        sellTokenDecimals: 9,
        buyTokenDecimals: 6,
        slippagePercentage: 0.5,
        grossToAmountBaseUnits: '150000000',
        netToAmountBaseUnits: '150000000',
        feeAmountBaseUnits: '0',
        feeAmountSymbol: null,
        feeAmountDecimals: null,
        feeMode: 'disabled',
        feeType: 'no fee',
        feeBps: 0,
        feeDisplayLabel: 'no fee',
        feeAssetSide: 'none',
        executionFee: createDisabledFeeConfig('jupiter', 'solana'),
      },
    });

    expect(session.uri).not.toBeNull();
    const sessionUrl = new URL(session.uri ?? '');

    expect(sessionUrl.origin).toBe('https://phantom.app');
    expect(sessionUrl.pathname).toBe('/ul/v1/connect');
    expect(sessionUrl.searchParams.get('dapp_encryption_public_key')).toBeTruthy();
    expect(sessionUrl.searchParams.get('cluster')).toBe('mainnet-beta');

    const redirectLink = new URL(sessionUrl.searchParams.get('redirect_link') ?? '');
    const sessionId = redirectLink.searchParams.get('sessionId');

    expect(redirectLink.origin).toBe('https://1303118-cr22992.tw1.ru');
    expect(redirectLink.pathname).toBe('/phantom/callback/connect');
    expect(sessionId).toBeTruthy();

    const connectUrl = service.getPhantomConnectUrl(sessionId ?? '');

    expect(connectUrl).toBe(session.uri);

    const storedSession = sessionStore.get(sessionId ?? '');
    const phantomState = storedSession?.phantom;

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
    expect(signUrl).not.toBeNull();
    expect(signUrl ?? '').toContain('https://phantom.app/ul/v1/signTransaction');

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
