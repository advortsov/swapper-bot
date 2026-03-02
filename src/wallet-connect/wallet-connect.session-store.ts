import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import NodeCache from 'node-cache';

import type {
  IPendingTelegramAction,
  WalletConnectionFamily,
  IWalletConnectionSession,
  IWalletConnectSession,
} from './interfaces/wallet-connect.interface';

const DEFAULT_WALLET_CONNECT_SESSION_TTL_SEC = 604800;
const DEFAULT_PENDING_ACTION_TTL_SEC = 300;
const MIN_TTL_SECONDS = 1;

@Injectable()
export class WalletConnectSessionStore {
  private readonly cache: NodeCache;
  private readonly sessionTtlSeconds: number;
  private readonly pendingActionTtlSeconds: number;

  public constructor(private readonly configService: ConfigService) {
    this.sessionTtlSeconds = this.resolveTtl(
      'WALLET_CONNECT_SESSION_TTL_SEC',
      DEFAULT_WALLET_CONNECT_SESSION_TTL_SEC,
    );
    this.pendingActionTtlSeconds = this.resolveTtl(
      'TELEGRAM_PENDING_ACTION_TTL_SEC',
      DEFAULT_PENDING_ACTION_TTL_SEC,
    );
    this.cache = new NodeCache({
      stdTTL: this.sessionTtlSeconds,
      useClones: false,
      deleteOnExpire: true,
      checkperiod: Math.max(Math.floor(this.pendingActionTtlSeconds / 2), 1),
    });
  }

  public save(session: IWalletConnectSession): void {
    this.cache.set(this.getSwapSessionKey(session.sessionId), session, this.sessionTtlSeconds);
  }

  public get(sessionId: string): IWalletConnectSession | null {
    const session = this.cache.get<IWalletConnectSession>(this.getSwapSessionKey(sessionId));
    return session ?? null;
  }

  public delete(sessionId: string): void {
    this.cache.del(this.getSwapSessionKey(sessionId));
  }

  public saveConnection(connection: IWalletConnectionSession): void {
    this.cache.set(
      this.getConnectionKey(connection.userId, connection.family),
      connection,
      this.sessionTtlSeconds,
    );
  }

  public getConnection(
    userId: string,
    family: WalletConnectionFamily,
  ): IWalletConnectionSession | null {
    const connection = this.cache.get<IWalletConnectionSession>(
      this.getConnectionKey(userId, family),
    );
    return connection ?? null;
  }

  public touchConnection(
    userId: string,
    family: WalletConnectionFamily,
  ): IWalletConnectionSession | null {
    const connection = this.getConnection(userId, family);

    if (!connection) {
      return null;
    }

    const nextConnection: IWalletConnectionSession = {
      ...connection,
      lastUsedAt: Date.now(),
    };

    this.saveConnection(nextConnection);
    return nextConnection;
  }

  public deleteConnection(userId: string, family: WalletConnectionFamily): void {
    this.cache.del(this.getConnectionKey(userId, family));
  }

  public listConnections(userId: string): {
    evm: IWalletConnectionSession | null;
    solana: IWalletConnectionSession | null;
  } {
    return {
      evm: this.getConnection(userId, 'evm'),
      solana: this.getConnection(userId, 'solana'),
    };
  }

  public savePendingAction(action: IPendingTelegramAction): void {
    this.cache.set(
      this.getPendingActionKey(action.token),
      action,
      Math.max(Math.ceil((action.expiresAt - Date.now()) / 1000), MIN_TTL_SECONDS),
    );
    this.cache.set(
      this.getPendingActionByUserKey(action.userId, action.kind),
      action.token,
      Math.max(Math.ceil((action.expiresAt - Date.now()) / 1000), MIN_TTL_SECONDS),
    );
  }

  public createPendingAction(
    input: Omit<IPendingTelegramAction, 'createdAt' | 'expiresAt'>,
  ): IPendingTelegramAction {
    const now = Date.now();
    const action: IPendingTelegramAction = {
      ...input,
      createdAt: now,
      expiresAt: now + this.pendingActionTtlSeconds * 1000,
    };

    this.savePendingAction(action);
    return action;
  }

  public getPendingAction(token: string): IPendingTelegramAction | null {
    return this.cache.get<IPendingTelegramAction>(this.getPendingActionKey(token)) ?? null;
  }

  public getPendingActionByUser(
    userId: string,
    kind: IPendingTelegramAction['kind'],
  ): IPendingTelegramAction | null {
    const token = this.cache.get<string>(this.getPendingActionByUserKey(userId, kind));

    if (!token) {
      return null;
    }

    return this.getPendingAction(token);
  }

  public consumePendingAction(userId: string, token: string): IPendingTelegramAction | null {
    const action = this.getPendingAction(token);

    if (action?.userId !== userId) {
      return null;
    }

    this.deletePendingAction(token);
    return action;
  }

  public deletePendingAction(token: string): void {
    const action = this.getPendingAction(token);
    this.cache.del(this.getPendingActionKey(token));

    if (action) {
      this.cache.del(this.getPendingActionByUserKey(action.userId, action.kind));
    }
  }

  private getSwapSessionKey(sessionId: string): string {
    return `wc:session:${sessionId}`;
  }

  private getConnectionKey(userId: string, family: WalletConnectionFamily): string {
    return `wc:session:${userId}:${family}`;
  }

  private getPendingActionKey(token: string): string {
    return `wc:pending:${token}`;
  }

  private getPendingActionByUserKey(userId: string, kind: IPendingTelegramAction['kind']): string {
    return `wc:pending:${userId}:${kind}`;
  }

  private resolveTtl(key: string, fallback: number): number {
    const rawValue = this.configService.get<string>(key);
    const parsed = Number.parseInt(rawValue ?? `${fallback}`, 10);

    if (!Number.isInteger(parsed) || parsed < MIN_TTL_SECONDS) {
      return fallback;
    }

    return parsed;
  }
}
