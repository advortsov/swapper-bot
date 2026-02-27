import { Injectable } from '@nestjs/common';

import type { IWalletConnectSession } from './interfaces/wallet-connect.interface';

@Injectable()
export class WalletConnectSessionStore {
  private readonly sessions = new Map<string, IWalletConnectSession>();

  public save(session: IWalletConnectSession): void {
    this.sessions.set(session.sessionId, session);
  }

  public get(sessionId: string): IWalletConnectSession | null {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return null;
    }

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  public delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}
