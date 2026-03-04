import { Injectable } from '@nestjs/common';

import type {
  ICreateWalletConnectConnectionInput,
  ICreateWalletConnectApproveSessionInput,
  ICreateWalletConnectSessionInput,
  IPhantomCallbackQuery,
  IWalletConnectionSession,
  IWalletConnectionStatus,
  IWalletConnectSessionPublic,
} from './interfaces/wallet-connect.interface';
import { WalletConnectConnectedWalletService } from './wallet-connect.connected-wallet.service';
import { WalletConnectConnectionService } from './wallet-connect.connection.service';
import { WalletConnectPhantomService } from './wallet-connect.phantom.service';
import { WalletConnectSessionOrchestrator } from './wallet-connect.session-orchestrator';
import type { ChainType } from '../chains/interfaces/chain.interface';

@Injectable()
export class WalletConnectService {
  public constructor(
    private readonly connectedWalletService: WalletConnectConnectedWalletService,
    private readonly connectionService: WalletConnectConnectionService,
    private readonly phantomService: WalletConnectPhantomService,
    private readonly sessionOrchestrator: WalletConnectSessionOrchestrator,
  ) {}

  public getConnectionStatus(userId: string): IWalletConnectionStatus {
    return this.connectionService.getConnectionStatus(userId);
  }

  public async connect(
    input: ICreateWalletConnectConnectionInput,
  ): Promise<IWalletConnectSessionPublic> {
    if (input.chain === 'solana') {
      return this.phantomService.createConnectionSession(input);
    }

    const cached = this.getReusableSession(input.userId, input.chain);

    if (cached) {
      return this.connectedWalletService.createConnectedWalletConnectResponse(cached);
    }

    return this.sessionOrchestrator.createConnectSession(input);
  }

  public async disconnect(userId: string, chainOrAll: ChainType | 'all'): Promise<void> {
    await this.connectionService.disconnect(userId, chainOrAll);
  }

  public async createSession(
    input: ICreateWalletConnectSessionInput,
  ): Promise<IWalletConnectSessionPublic> {
    if (input.swapPayload.chain === 'solana') {
      const cached = this.getReusableSession(input.userId, 'solana');

      if (cached?.phantom) {
        return this.phantomService.createSwapSessionFromConnection(input, cached);
      }

      return this.phantomService.createSession(input);
    }

    const cached = this.getReusableSession(input.userId, input.swapPayload.chain);

    if (cached?.topic) {
      return this.connectedWalletService.createConnectedWalletSwapResponse({
        connection: cached,
        swapPayload: input.swapPayload,
      });
    }

    return this.sessionOrchestrator.createSwapSession(input);
  }

  public async createApproveSession(
    input: ICreateWalletConnectApproveSessionInput,
  ): Promise<IWalletConnectSessionPublic> {
    const cached = this.getReusableSession(input.userId, input.approvalPayload.chain);

    if (cached?.topic) {
      return this.connectedWalletService.createConnectedWalletApproveResponse({
        connection: cached,
        approvalPayload: input.approvalPayload,
      });
    }

    return this.sessionOrchestrator.createApproveSession(input);
  }

  public getPhantomConnectUrl(sessionId: string): string {
    return this.phantomService.getPhantomConnectUrl(sessionId);
  }

  public async handlePhantomConnectCallback(query: IPhantomCallbackQuery): Promise<string | null> {
    return this.phantomService.handleConnectCallback(query);
  }

  public async handlePhantomSignCallback(
    query: IPhantomCallbackQuery,
  ): Promise<{ explorerUrl: string; transactionHash: string }> {
    return this.phantomService.handleSignCallback(query);
  }

  public getReusableSession(userId: string, chain: ChainType): IWalletConnectionSession | null {
    return this.connectionService.getReusableSession(userId, chain);
  }
}
