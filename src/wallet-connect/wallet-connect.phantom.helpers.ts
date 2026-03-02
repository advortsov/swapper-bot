import type { ConfigService } from '@nestjs/config';
import bs58 from 'bs58';
import { Buffer } from 'node:buffer';
import nacl from 'tweetnacl';

import type {
  IPhantomCallbackQuery,
  IPhantomSessionState,
  IWalletConnectSession,
} from './interfaces/wallet-connect.interface';
import {
  PHANTOM_APP_BASE_URL,
  PHANTOM_NONCE_LENGTH,
  PHANTOM_SIGN_CALLBACK_PATH,
  PHANTOM_SIGN_TRANSACTION_METHOD,
} from './wallet-connect.constants';
import type {
  IPhantomConnectPayload,
  IPhantomSignedTransactionPayload,
} from './wallet-connect.phantom.types';
import type { WalletConnectSessionStore } from './wallet-connect.session-store';
import type { ISwapTransaction } from '../aggregators/interfaces/aggregator.interface';
import { BusinessException } from '../common/exceptions/business.exception';

export function throwIfPhantomRejected(
  query: IPhantomCallbackQuery,
  fallbackMessage: string,
): void {
  if (!query.errorCode && !query.errorMessage) {
    return;
  }

  const details = [query.errorCode, query.errorMessage].filter(Boolean).join(': ');
  throw new BusinessException(details === '' ? fallbackMessage : `${fallbackMessage}: ${details}`);
}

export function getRequiredQueryValue(value: string | undefined, key: string): string {
  if (!value || value.trim() === '') {
    throw new BusinessException(`Phantom callback is missing query parameter "${key}"`);
  }

  return value;
}

export function getRequiredPayloadValue(value: string | undefined, key: string): string {
  if (!value || value.trim() === '') {
    throw new BusinessException(`Phantom payload field "${key}" is missing`);
  }

  return value;
}

export function toPhantomConnectPayload(payload: Record<string, string>): IPhantomConnectPayload {
  return {
    public_key: getRequiredPayloadValue(payload['public_key'], 'public_key'),
    session: getRequiredPayloadValue(payload['session'], 'session'),
  };
}

export function toPhantomSignedTransactionPayload(
  payload: Record<string, string>,
): IPhantomSignedTransactionPayload {
  return {
    transaction: getRequiredPayloadValue(payload['transaction'], 'transaction'),
  };
}

export function decryptPhantomPayload(
  data: string,
  nonce: string,
  sharedSecret: Uint8Array,
): Record<string, string> {
  const decryptedData = nacl.box.open.after(
    decodeBase58(data, 'data'),
    decodeBase58(nonce, 'nonce'),
    sharedSecret,
  );

  if (!decryptedData) {
    throw new BusinessException('Failed to decrypt Phantom payload');
  }

  return JSON.parse(Buffer.from(decryptedData).toString('utf8')) as Record<string, string>;
}

export function encryptPhantomPayload(
  payload: object,
  sharedSecret: Uint8Array,
): { nonce: string; payload: string } {
  const nonce = nacl.randomBytes(PHANTOM_NONCE_LENGTH);
  const encryptedPayload = nacl.box.after(
    Buffer.from(JSON.stringify(payload)),
    nonce,
    sharedSecret,
  );

  return {
    nonce: bs58.encode(nonce),
    payload: bs58.encode(encryptedPayload),
  };
}

export function buildPhantomSignTransactionUrl(input: {
  configService: ConfigService;
  session: IWalletConnectSession;
  transaction: ISwapTransaction;
  phantomState: IPhantomSessionState;
  sessionStore: WalletConnectSessionStore;
}): string {
  const { session, transaction, phantomState, sessionStore } = input;

  if (transaction.kind !== 'solana' || !transaction.serializedTransaction) {
    throw new BusinessException('Phantom expects a serialized Solana transaction');
  }

  const payload = encryptPhantomPayload(
    {
      session: getRequiredPayloadValue(phantomState.phantomSession, 'phantomSession'),
      transaction: transaction.serializedTransaction,
    },
    decodeBase58(
      getRequiredPayloadValue(phantomState.sharedSecret, 'sharedSecret'),
      'sharedSecret',
    ),
  );

  session.phantom = {
    ...phantomState,
    ...(typeof transaction.lastValidBlockHeight === 'number'
      ? { lastValidBlockHeight: transaction.lastValidBlockHeight }
      : {}),
  };
  sessionStore.save(session);

  return buildPhantomUrl(PHANTOM_SIGN_TRANSACTION_METHOD, {
    dapp_encryption_public_key: getRequiredPayloadValue(
      phantomState.dappEncryptionPublicKey,
      'dappEncryptionPublicKey',
    ),
    nonce: payload.nonce,
    redirect_link: buildAppUrl(
      input.configService.get<string>('APP_PUBLIC_URL') ?? 'https://example.org',
      PHANTOM_SIGN_CALLBACK_PATH,
      session.sessionId,
    ),
    payload: payload.payload,
  });
}

export function getRequiredLastValidBlockHeight(session: IWalletConnectSession): number {
  const lastValidBlockHeight = session.phantom?.lastValidBlockHeight;

  if (typeof lastValidBlockHeight !== 'number') {
    throw new BusinessException('Last valid block height is not available for Solana session');
  }

  return lastValidBlockHeight;
}

export function buildPhantomUrl(method: string, params: Record<string, string>): string {
  const url = new URL(method, PHANTOM_APP_BASE_URL);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

export function buildAppUrl(baseUrl: string, pathname: string, sessionId: string): string {
  const url = new URL(pathname, baseUrl);
  url.searchParams.set('sessionId', sessionId);
  return url.toString();
}

export function decodeBase58(value: string, label: string): Uint8Array {
  try {
    return bs58.decode(value);
  } catch {
    throw new BusinessException(`Failed to decode Phantom payload field "${label}"`);
  }
}

export function encodeBase58(value: Uint8Array, label: string): string {
  try {
    return bs58.encode(value);
  } catch {
    throw new BusinessException(`Failed to encode Phantom payload field "${label}"`);
  }
}

export function buildSolanaExplorerUrl(
  configService: ConfigService,
  transactionHash: string,
): string {
  const baseUrl = configService.get<string>('EXPLORER_URL_SOLANA') ?? 'https://solscan.io/tx/';
  return `${baseUrl}${transactionHash}`;
}
