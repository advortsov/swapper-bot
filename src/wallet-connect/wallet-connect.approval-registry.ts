import { Injectable } from '@nestjs/common';
import type { SessionTypes } from '@walletconnect/types';

@Injectable()
export class WalletConnectApprovalRegistry {
  private readonly approvals = new Map<string, () => Promise<SessionTypes.Struct>>();

  public set(sessionId: string, approval: () => Promise<SessionTypes.Struct>): void {
    this.approvals.set(sessionId, approval);
  }

  public get(sessionId: string): (() => Promise<SessionTypes.Struct>) | null {
    return this.approvals.get(sessionId) ?? null;
  }

  public delete(sessionId: string): void {
    this.approvals.delete(sessionId);
  }
}
