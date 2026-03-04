import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import nacl from 'tweetnacl';

import type {
  ICreateWalletConnectConnectionInput,
  ICreateWalletConnectSessionInput,
  IPhantomSessionState,
  IWalletConnectSession,
  IWalletConnectSessionPublic,
  IWalletConnectSwapPayload,
} from './interfaces/wallet-connect.interface';
import {
  DEFAULT_APP_PUBLIC_URL,
  DEFAULT_SWAP_TIMEOUT_SECONDS,
  MIN_SWAP_TIMEOUT_SECONDS,
  PHANTOM_CLUSTER,
  PHANTOM_CONNECT_CALLBACK_PATH,
  PHANTOM_CONNECT_METHOD,
} from './wallet-connect.constants';
import { buildAppUrl, buildPhantomUrl, encodeBase58 } from './wallet-connect.phantom.helpers';
import { WalletConnectSessionStore } from './wallet-connect.session-store';
import { BusinessException } from '../common/exceptions/business.exception';

@Injectable()
export class WalletConnectPhantomStateService {
  private readonly appPublicUrl: string;
  private readonly swapTimeoutSeconds: number;

  public constructor(
    private readonly configService: ConfigService,
    private readonly sessionStore: WalletConnectSessionStore,
  ) {
    this.appPublicUrl = this.configService.get<string>('APP_PUBLIC_URL') ?? DEFAULT_APP_PUBLIC_URL;
    this.swapTimeoutSeconds = this.resolveTimeoutSeconds();
  }

  public createConnectionSession(
    input: ICreateWalletConnectConnectionInput,
  ): IWalletConnectSessionPublic {
    const session = this.createBaseSession(input.userId, 'connect');
    this.sessionStore.save(session);
    return this.toPublicSession(session);
  }

  public createSwapSession(input: ICreateWalletConnectSessionInput): IWalletConnectSessionPublic {
    const session = this.createBaseSession(input.userId, 'swap', input.swapPayload);
    this.sessionStore.save(session);
    return this.toPublicSession(session);
  }

  public createSwapSessionFromConnection(
    input: ICreateWalletConnectSessionInput,
    phantomState: IPhantomSessionState,
  ): IWalletConnectSession {
    const session = this.createBaseSession(input.userId, 'swap', input.swapPayload, phantomState);
    this.sessionStore.save(session);
    return session;
  }

  public toPublicSession(session: IWalletConnectSession): IWalletConnectSessionPublic {
    return {
      sessionId: session.sessionId,
      uri: session.uri,
      expiresAt: new Date(session.expiresAt).toISOString(),
      walletDelivery: 'app-link',
    };
  }

  public getSolanaSession(sessionId: string): IWalletConnectSession {
    const session = this.sessionStore.get(sessionId);

    if (session?.family !== 'solana') {
      throw new BusinessException('Solana swap session is not found or expired');
    }

    return session;
  }

  public ensurePhantomState(session: IWalletConnectSession): IPhantomSessionState {
    if (!session.phantom) {
      throw new BusinessException('Phantom session state is not initialized');
    }

    return session.phantom;
  }

  public getConnectedPhantomState(session: IWalletConnectSession): IPhantomSessionState {
    const phantomState = session.phantom;

    if (
      !phantomState?.sharedSecret ||
      !phantomState.phantomSession ||
      !phantomState.walletAddress
    ) {
      throw new BusinessException('Phantom session is not connected');
    }

    return phantomState;
  }

  public getSwapPayload(session: IWalletConnectSession): IWalletConnectSwapPayload {
    if (!session.swapPayload) {
      throw new BusinessException('Solana swap payload is not initialized');
    }

    return session.swapPayload;
  }

  public saveReusableConnection(session: IWalletConnectSession): void {
    const phantomState = this.getConnectedPhantomState(session);
    const now = Date.now();

    this.sessionStore.saveConnection({
      userId: session.userId,
      family: 'solana',
      chain: 'solana',
      address: phantomState.walletAddress ?? '',
      walletLabel: 'Phantom',
      connectedAt: now,
      lastUsedAt: now,
      expiresAt: session.expiresAt,
      phantom: {
        ...phantomState,
      },
    });
  }

  private createBaseSession(
    userId: string,
    kind: 'connect' | 'swap',
    swapPayload?: ICreateWalletConnectSessionInput['swapPayload'],
    initialPhantomState?: IPhantomSessionState,
  ): IWalletConnectSession {
    const sessionId = randomUUID();
    const expiresAt = Date.now() + this.swapTimeoutSeconds * 1_000;
    const phantomState = initialPhantomState ?? this.createInitialPhantomState();

    const session: IWalletConnectSession = {
      sessionId,
      userId,
      uri: buildPhantomUrl(PHANTOM_CONNECT_METHOD, {
        dapp_encryption_public_key: phantomState.dappEncryptionPublicKey,
        cluster: PHANTOM_CLUSTER,
        app_url: this.appPublicUrl,
        redirect_link: buildAppUrl(this.appPublicUrl, PHANTOM_CONNECT_CALLBACK_PATH, sessionId),
      }),
      expiresAt,
      kind,
      family: 'solana',
      chain: 'solana',
      phantom: phantomState,
    };

    if (swapPayload) {
      session.swapPayload = swapPayload;
    }

    return session;
  }

  private createInitialPhantomState(): IPhantomSessionState {
    const keyPair = nacl.box.keyPair();

    return {
      dappEncryptionPublicKey: encodeBase58(keyPair.publicKey, 'dappEncryptionPublicKey'),
      dappEncryptionSecretKey: encodeBase58(keyPair.secretKey, 'dappEncryptionSecretKey'),
    };
  }

  private resolveTimeoutSeconds(): number {
    const rawTimeout = this.configService.get<string>('SWAP_TIMEOUT_SECONDS');
    const parsedTimeout = Number.parseInt(rawTimeout ?? `${DEFAULT_SWAP_TIMEOUT_SECONDS}`, 10);

    if (!Number.isInteger(parsedTimeout) || parsedTimeout < MIN_SWAP_TIMEOUT_SECONDS) {
      return DEFAULT_SWAP_TIMEOUT_SECONDS;
    }

    return parsedTimeout;
  }
}
