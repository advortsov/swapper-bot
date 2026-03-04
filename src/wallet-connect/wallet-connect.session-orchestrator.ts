import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import type {
  ICreateWalletConnectApproveSessionInput,
  ICreateWalletConnectConnectionInput,
  ICreateWalletConnectSessionInput,
  IWalletConnectSession,
  IWalletConnectSessionPublic,
} from './interfaces/wallet-connect.interface';
import { WalletConnectApprovalRegistry } from './wallet-connect.approval-registry';
import { WalletConnectClientService } from './wallet-connect.client.service';
import { DEFAULT_SWAP_TIMEOUT_SECONDS, MIN_SWAP_TIMEOUT_SECONDS } from './wallet-connect.constants';
import { WalletConnectLifecycleService } from './wallet-connect.lifecycle.service';
import { createWalletConnectSessionRecord } from './wallet-connect.session-factory';
import { WalletConnectSessionStore } from './wallet-connect.session-store';

@Injectable()
export class WalletConnectSessionOrchestrator {
  private readonly swapTimeoutSeconds: number;

  @Inject()
  private readonly sessionStore!: WalletConnectSessionStore;

  public constructor(
    private readonly approvalRegistry: WalletConnectApprovalRegistry,
    private readonly clientService: WalletConnectClientService,
    private readonly configService: ConfigService,
    private readonly lifecycleService: WalletConnectLifecycleService,
  ) {
    this.swapTimeoutSeconds = this.resolveTimeoutSeconds();
  }

  public async createConnectSession(
    input: ICreateWalletConnectConnectionInput,
  ): Promise<IWalletConnectSessionPublic> {
    return this.createEvmSession({
      kind: 'connect',
      userId: input.userId,
      chain: input.chain,
    });
  }

  public async createSwapSession(
    input: ICreateWalletConnectSessionInput,
  ): Promise<IWalletConnectSessionPublic> {
    return this.createEvmSession({
      kind: 'swap',
      userId: input.userId,
      chain: input.swapPayload.chain,
      swapPayload: { ...input.swapPayload },
    });
  }

  public async createApproveSession(
    input: ICreateWalletConnectApproveSessionInput,
  ): Promise<IWalletConnectSessionPublic> {
    return this.createEvmSession({
      kind: 'approve',
      userId: input.userId,
      chain: input.approvalPayload.chain,
      approvalPayload: { ...input.approvalPayload },
    });
  }

  private async createEvmSession(input: {
    kind: IWalletConnectSession['kind'];
    userId: string;
    chain: IWalletConnectSession['chain'];
    swapPayload?: IWalletConnectSession['swapPayload'];
    approvalPayload?: IWalletConnectSession['approvalPayload'];
  }): Promise<IWalletConnectSessionPublic> {
    this.clientService.ensureConfigured();
    const { approval, publicSession, session } = await createWalletConnectSessionRecord({
      kind: input.kind,
      signClient: await this.clientService.getClient(),
      swapPayload: input.swapPayload,
      approvalPayload: input.approvalPayload,
      swapTimeoutSeconds: this.swapTimeoutSeconds,
      userId: input.userId,
      sessionIdFactory: randomUUID,
      chain: input.chain,
    });
    this.sessionStore.save(session);
    this.approvalRegistry.set(session.sessionId, approval);
    void this.lifecycleService.handle(session.sessionId);

    return publicSession;
  }

  private resolveTimeoutSeconds(): number {
    const rawTimeout = this.configService.get<string>('SWAP_TIMEOUT_SECONDS');
    const parsedTimeout = Number.parseInt(rawTimeout ?? `${DEFAULT_SWAP_TIMEOUT_SECONDS}`, 10);

    return !Number.isInteger(parsedTimeout) || parsedTimeout < MIN_SWAP_TIMEOUT_SECONDS
      ? DEFAULT_SWAP_TIMEOUT_SECONDS
      : parsedTimeout;
  }
}
