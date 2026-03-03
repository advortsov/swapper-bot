import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import SignClient from '@walletconnect/sign-client';
import type { SessionTypes } from '@walletconnect/types';
import { randomUUID } from 'node:crypto';

import { AllowanceService } from '../allowance/allowance.service';
import type {
  ICreateWalletConnectConnectionInput,
  ICreateWalletConnectApproveSessionInput,
  ICreateWalletConnectSessionInput,
  IPhantomCallbackQuery,
  IWalletConnectionSession,
  IWalletConnectionStatus,
  IWalletConnectSession,
  IWalletConnectSessionPublic,
} from './interfaces/wallet-connect.interface';
import { DEFAULT_APP_PUBLIC_URL, MIN_SWAP_TIMEOUT_SECONDS } from './wallet-connect.constants';
import {
  createWalletConnectMetadata,
  escapeWalletConnectHtml,
  extractWalletAddress,
  getWalletConnectSwapPayload,
  getWalletConnectionFamily,
  getWalletConnectErrorWithLog,
  requestWalletConnectExecution,
  registerWalletConnectClientEvents,
  saveWalletConnection,
  sendWalletConnectTelegramMessage,
  waitForWalletConnectApproval,
} from './wallet-connect.evm.helpers';
import {
  executeWalletConnectApprove,
  executeWalletConnectSwap,
  handleWalletConnectSessionError,
  notifyConnectedWallet,
} from './wallet-connect.execution';
import { WalletConnectPhantomService } from './wallet-connect.phantom.service';
import { createWalletConnectSessionRecord } from './wallet-connect.session-factory';
import { WalletConnectSessionStore } from './wallet-connect.session-store';
import { AGGREGATORS_TOKEN } from '../aggregators/aggregators.constants';
import type { IAggregator, ISwapTransaction } from '../aggregators/interfaces/aggregator.interface';
import type { ChainType } from '../chains/interfaces/chain.interface';
import { BusinessException } from '../common/exceptions/business.exception';
import { SwapExecutionAuditService } from '../swap/swap-execution-audit.service';

const DEFAULT_SWAP_TIMEOUT_SECONDS = 300;
const WALLETCONNECT_DISCONNECT_REASON = {
  code: 6000,
  message: 'Disconnected by user',
};

@Injectable()
export class WalletConnectService implements OnModuleInit {
  private readonly logger = new Logger(WalletConnectService.name);
  private readonly projectId: string;
  private readonly appPublicUrl: string;
  private readonly swapTimeoutSeconds: number;
  private readonly telegramBotToken: string;
  private signClient: SignClient | null = null;
  private readonly approvals = new Map<string, () => Promise<SessionTypes.Struct>>();

  @Inject(AGGREGATORS_TOKEN)
  private readonly aggregators!: readonly IAggregator[];

  @Inject()
  private readonly allowanceService!: AllowanceService;

  public constructor(
    private readonly configService: ConfigService,
    private readonly sessionStore: WalletConnectSessionStore,
    private readonly swapExecutionAuditService: SwapExecutionAuditService,
    private readonly phantomService: WalletConnectPhantomService,
  ) {
    this.projectId = this.configService.get<string>('WC_PROJECT_ID') ?? '';
    this.appPublicUrl = this.configService.get<string>('APP_PUBLIC_URL') ?? DEFAULT_APP_PUBLIC_URL;
    this.swapTimeoutSeconds = this.resolveTimeoutSeconds();
    this.telegramBotToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
  }

  public async onModuleInit(): Promise<void> {
    if (this.projectId.trim() === '') {
      this.logger.warn('WalletConnect EVM flow is disabled: WC_PROJECT_ID is empty');
      return;
    }

    this.signClient = await SignClient.init({
      projectId: this.projectId,
      metadata: createWalletConnectMetadata(this.appPublicUrl),
    });
    registerWalletConnectClientEvents(this.signClient, this.logger);
  }

  public getConnectionStatus(userId: string): IWalletConnectionStatus {
    return this.sessionStore.listConnections(userId);
  }

  public async connect(
    input: ICreateWalletConnectConnectionInput,
  ): Promise<IWalletConnectSessionPublic> {
    if (input.chain === 'solana') {
      return this.phantomService.createConnectionSession(input);
    }

    const cached = this.getReusableSession(input.userId, input.chain);

    if (cached) {
      return {
        sessionId: randomUUID(),
        uri: null,
        expiresAt: new Date(cached.expiresAt).toISOString(),
        walletDelivery: 'connected-wallet',
      };
    }

    return this.createEvmConnectSession(input);
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

      if (family === 'evm' && connection.topic) {
        try {
          const signClient = await this.getSignClient();
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
      const syntheticSessionId = randomUUID();
      void executeWalletConnectSwap({
        deps: this.getExecutionDependencies(),
        topic: cached.topic,
        userId: cached.userId,
        walletAddress: cached.address,
        swapPayload: input.swapPayload,
      });

      return {
        sessionId: syntheticSessionId,
        uri: null,
        expiresAt: new Date(cached.expiresAt).toISOString(),
        walletDelivery: 'connected-wallet',
      };
    }

    return this.createEvmSwapSession(input);
  }

  public async createApproveSession(
    input: ICreateWalletConnectApproveSessionInput,
  ): Promise<IWalletConnectSessionPublic> {
    const cached = this.getReusableSession(input.userId, input.approvalPayload.chain);

    if (cached?.topic) {
      const syntheticSessionId = randomUUID();
      void this.executeApprovalOverConnection(cached, input.approvalPayload);

      return {
        sessionId: syntheticSessionId,
        uri: null,
        expiresAt: new Date(cached.expiresAt).toISOString(),
        walletDelivery: 'connected-wallet',
      };
    }

    return this.createEvmApproveSession(input);
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
    return this.sessionStore.touchConnection(userId, getWalletConnectionFamily(chain));
  }

  private async createEvmConnectSession(
    input: ICreateWalletConnectConnectionInput,
  ): Promise<IWalletConnectSessionPublic> {
    this.ensureWalletConnectConfigured();
    const { approval, publicSession, session } = await createWalletConnectSessionRecord({
      kind: 'connect',
      signClient: await this.getSignClient(),
      swapTimeoutSeconds: this.swapTimeoutSeconds,
      userId: input.userId,
      sessionIdFactory: randomUUID,
      chain: input.chain,
    });
    this.sessionStore.save(session);
    this.approvals.set(session.sessionId, approval);
    void this.handleSessionLifecycle(session.sessionId);

    return publicSession;
  }

  private async createEvmSwapSession(
    input: ICreateWalletConnectSessionInput,
  ): Promise<IWalletConnectSessionPublic> {
    this.ensureWalletConnectConfigured();
    const { approval, publicSession, session } = await createWalletConnectSessionRecord({
      kind: 'swap',
      signClient: await this.getSignClient(),
      swapPayload: { ...input.swapPayload },
      swapTimeoutSeconds: this.swapTimeoutSeconds,
      userId: input.userId,
      sessionIdFactory: randomUUID,
      chain: input.swapPayload.chain,
    });
    this.sessionStore.save(session);
    this.approvals.set(session.sessionId, approval);
    void this.handleSessionLifecycle(session.sessionId);

    return publicSession;
  }

  private async createEvmApproveSession(
    input: ICreateWalletConnectApproveSessionInput,
  ): Promise<IWalletConnectSessionPublic> {
    this.ensureWalletConnectConfigured();
    const { approval, publicSession, session } = await createWalletConnectSessionRecord({
      kind: 'approve',
      signClient: await this.getSignClient(),
      approvalPayload: { ...input.approvalPayload },
      swapTimeoutSeconds: this.swapTimeoutSeconds,
      userId: input.userId,
      sessionIdFactory: randomUUID,
      chain: input.approvalPayload.chain,
    });
    this.sessionStore.save(session);
    this.approvals.set(session.sessionId, approval);
    void this.handleSessionLifecycle(session.sessionId);

    return publicSession;
  }

  private ensureWalletConnectConfigured(): void {
    if (this.projectId.trim() === '') {
      throw new BusinessException('WC_PROJECT_ID is required for EVM WalletConnect flows');
    }
  }

  private resolveTimeoutSeconds(): number {
    const rawTimeout = this.configService.get<string>('SWAP_TIMEOUT_SECONDS');
    const parsedTimeout = Number.parseInt(rawTimeout ?? `${DEFAULT_SWAP_TIMEOUT_SECONDS}`, 10);
    return !Number.isInteger(parsedTimeout) || parsedTimeout < MIN_SWAP_TIMEOUT_SECONDS
      ? DEFAULT_SWAP_TIMEOUT_SECONDS
      : parsedTimeout;
  }

  private async getSignClient(): Promise<SignClient> {
    this.signClient ??= await SignClient.init({
      projectId: this.projectId,
      metadata: createWalletConnectMetadata(this.appPublicUrl),
    });
    registerWalletConnectClientEvents(this.signClient, this.logger);

    return this.signClient;
  }

  private async handleSessionLifecycle(sessionId: string): Promise<void> {
    const session = this.sessionStore.get(sessionId);

    if (!session) {
      return;
    }

    try {
      const approvalCallback = this.approvals.get(sessionId);

      if (!approvalCallback) {
        throw new BusinessException('WalletConnect approval promise is not available');
      }

      const approvedSession = await waitForWalletConnectApproval(
        approvalCallback,
        session.expiresAt,
      );
      await this.processApprovedSession(session, approvedSession);
    } catch (error: unknown) {
      const message = this.getErrorMessage(error);
      this.logger.error(`WalletConnect flow failed: ${message}`);
      await this.handleSessionError(session, message);
    } finally {
      this.sessionStore.delete(sessionId);
      this.approvals.delete(sessionId);
    }
  }

  private async processApprovedSession(
    session: IWalletConnectSession,
    approvedSession: SessionTypes.Struct,
  ): Promise<void> {
    const walletAddress = extractWalletAddress(approvedSession, session.chain);
    const connection = saveWalletConnection({
      session,
      approvedSession,
      walletAddress,
    });
    this.sessionStore.saveConnection(connection);

    if (session.kind === 'connect') {
      await this.notifyConnectedWallet(session, walletAddress);
      return;
    }

    if (session.kind === 'approve') {
      await this.executeApprovedApproval(session, approvedSession, walletAddress);
      return;
    }

    await this.executeApprovedSwap(session, approvedSession, walletAddress);
  }

  private async notifyConnectedWallet(
    session: IWalletConnectSession,
    walletAddress: string,
  ): Promise<void> {
    await notifyConnectedWallet({
      chainFamily: session.family === 'solana' ? 'Solana' : 'EVM',
      logger: this.logger,
      telegramBotToken: this.telegramBotToken,
      userId: session.userId,
      walletAddress,
    });
  }

  private async executeApprovedSwap(
    session: IWalletConnectSession,
    approvedSession: SessionTypes.Struct,
    walletAddress: string,
  ): Promise<void> {
    await executeWalletConnectSwap({
      deps: this.getExecutionDependencies(),
      topic: approvedSession.topic,
      userId: session.userId,
      walletAddress,
      swapPayload: getWalletConnectSwapPayload(session),
    });
  }

  private async executeApprovedApproval(
    session: IWalletConnectSession,
    approvedSession: SessionTypes.Struct,
    walletAddress: string,
  ): Promise<void> {
    const approvalPayload = session.approvalPayload;

    if (!approvalPayload) {
      throw new BusinessException(
        'Approve payload is not available for this WalletConnect session',
      );
    }

    await executeWalletConnectApprove({
      approvalPayload,
      deps: this.getExecutionDependencies(),
      successTitle: 'Approve отправлен',
      topic: approvedSession.topic,
      userId: session.userId,
      walletAddress,
    });
  }

  private async executeApprovalOverConnection(
    connection: IWalletConnectionSession,
    approvalPayload: ICreateWalletConnectApproveSessionInput['approvalPayload'],
  ): Promise<void> {
    try {
      await executeWalletConnectApprove({
        approvalPayload,
        deps: this.getExecutionDependencies(),
        successTitle: 'Approve отправлен в подключённый кошелёк',
        topic: connection.topic ?? '',
        userId: connection.userId,
        walletAddress: connection.address,
      });
    } catch (error: unknown) {
      await sendWalletConnectTelegramMessage({
        telegramBotToken: this.telegramBotToken,
        chatId: connection.userId,
        text: `❌ <b>Ошибка:</b> ${escapeWalletConnectHtml(this.getErrorMessage(error))}`,
        logger: this.logger,
      });
    }
  }

  private async handleSessionError(session: IWalletConnectSession, message: string): Promise<void> {
    await handleWalletConnectSessionError({
      deps: {
        logger: this.logger,
        swapExecutionAuditService: this.swapExecutionAuditService,
        telegramBotToken: this.telegramBotToken,
      },
      message,
      session,
    });
  }

  private async requestWalletExecution(
    topic: string,
    chain: ChainType,
    walletAddress: string,
    transaction: ISwapTransaction,
  ): Promise<string> {
    return requestWalletConnectExecution({
      signClient: await this.getSignClient(),
      topic,
      chain,
      walletAddress,
      transaction,
    });
  }

  private getErrorMessage(error: unknown): string {
    return getWalletConnectErrorWithLog(error, this.logger);
  }

  private getExecutionDependencies(): {
    allowanceService: AllowanceService;
    aggregators: readonly IAggregator[];
    configService: ConfigService;
    logger: Logger;
    requestWalletExecution: (
      topic: string,
      chain: ChainType,
      walletAddress: string,
      transaction: ISwapTransaction,
    ) => Promise<string>;
    swapExecutionAuditService: SwapExecutionAuditService;
    telegramBotToken: string;
  } {
    return {
      allowanceService: this.allowanceService,
      aggregators: this.aggregators,
      configService: this.configService,
      logger: this.logger,
      requestWalletExecution: this.requestWalletExecution.bind(this),
      swapExecutionAuditService: this.swapExecutionAuditService,
      telegramBotToken: this.telegramBotToken,
    };
  }
}
