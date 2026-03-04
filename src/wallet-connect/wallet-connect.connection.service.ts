import { Injectable, Logger } from '@nestjs/common';

import type {
  IWalletConnectionSession,
  IWalletConnectionStatus,
} from './interfaces/wallet-connect.interface';
import { WalletConnectClientService } from './wallet-connect.client.service';
import {
  getWalletConnectionFamily,
  getWalletConnectErrorWithLog,
} from './wallet-connect.evm.helpers';
import { WalletConnectSessionStore } from './wallet-connect.session-store';
import type { ChainType } from '../chains/interfaces/chain.interface';

const WALLETCONNECT_DISCONNECT_REASON = {
  code: 6000,
  message: 'Disconnected by user',
};

@Injectable()
export class WalletConnectConnectionService {
  private readonly logger = new Logger(WalletConnectConnectionService.name);

  public constructor(
    private readonly clientService: WalletConnectClientService,
    private readonly sessionStore: WalletConnectSessionStore,
  ) {}

  public getConnectionStatus(userId: string): IWalletConnectionStatus {
    return this.sessionStore.listConnections(userId);
  }

  public getReusableSession(userId: string, chain: ChainType): IWalletConnectionSession | null {
    return this.sessionStore.touchConnection(userId, getWalletConnectionFamily(chain));
  }

  public async disconnect(userId: string, chainOrAll: ChainType | 'all'): Promise<void> {
    const families =
      chainOrAll === 'all'
        ? (['evm', 'solana'] as const)
        : ([getWalletConnectionFamily(chainOrAll)] as const);

    for (const family of families) {
      const connection = this.sessionStore.getConnection(userId, family);

      if (!connection) {
        continue;
      }

      if (family === 'evm' && connection.topic && this.clientService.isEnabled()) {
        try {
          const signClient = await this.clientService.getClient();
          await signClient.disconnect({
            topic: connection.topic,
            reason: WALLETCONNECT_DISCONNECT_REASON,
          });
        } catch (error: unknown) {
          this.logger.warn(`WalletConnect disconnect failed: ${this.getErrorMessage(error)}`);
        }
      }

      this.sessionStore.deleteConnection(userId, family);
    }
  }

  private getErrorMessage(error: unknown): string {
    return getWalletConnectErrorWithLog(error, this.logger);
  }
}
