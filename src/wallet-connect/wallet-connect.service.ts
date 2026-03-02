import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import SignClient from '@walletconnect/sign-client';
import type { SessionTypes } from '@walletconnect/types';
import { randomUUID } from 'node:crypto';

import type {
  ICreateWalletConnectConnectionInput,
  ICreateWalletConnectSessionInput,
  IPhantomCallbackQuery,
  IWalletConnectionSession,
  IWalletConnectionStatus,
  IWalletConnectSession,
  IWalletConnectSessionPublic,
} from './interfaces/wallet-connect.interface';
import { DEFAULT_APP_PUBLIC_URL, MIN_SWAP_TIMEOUT_SECONDS } from './wallet-connect.constants';
import {
  buildSwapTransactionForPayload,
  buildWalletExplorerUrl,
  createWalletConnectMetadata,
  escapeWalletConnectHtml,
  executeWalletSwapOverConnection,
  extractWalletAddress,
  getWalletConnectChainConfig,
  getWalletConnectSwapPayload,
  getWalletConnectionFamily,
  getWalletConnectErrorWithLog,
  requestWalletConnectExecution,
  registerWalletConnectClientEvents,
  resolveWalletConnectAggregator,
  saveWalletConnection,
  sendWalletConnectTelegramMessage,
  waitForWalletConnectApproval,
} from './wallet-connect.evm.helpers';
import { WalletConnectPhantomService } from './wallet-connect.phantom.service';
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
      void executeWalletSwapOverConnection({
        connection: cached,
        swapPayload: input.swapPayload,
        aggregators: this.aggregators,
        configService: this.configService,
        requestExecution: this.requestWalletExecution.bind(this),
        swapExecutionAuditService: this.swapExecutionAuditService,
        telegramBotToken: this.telegramBotToken,
        logger: this.logger,
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
    const family = getWalletConnectionFamily(chain);
    return this.sessionStore.touchConnection(userId, family);
  }

  private async createEvmConnectSession(
    input: ICreateWalletConnectConnectionInput,
  ): Promise<IWalletConnectSessionPublic> {
    this.ensureWalletConnectConfigured();
    const signClient = await this.getSignClient();
    const chainConfig = getWalletConnectChainConfig(input.chain);
    const { uri, approval } = await signClient.connect({
      requiredNamespaces: {
        [chainConfig.namespace]: {
          methods: [...chainConfig.methods],
          chains: [chainConfig.chainId],
          events: [...chainConfig.events],
        },
      },
    });

    if (!uri) {
      throw new BusinessException('Failed to create WalletConnect URI');
    }

    const sessionId = randomUUID();
    const expiresAt = Date.now() + this.swapTimeoutSeconds * 1_000;
    const session: IWalletConnectSession = {
      sessionId,
      userId: input.userId,
      uri,
      expiresAt,
      kind: 'connect',
      family: 'evm',
      chain: input.chain,
    };

    this.sessionStore.save(session);
    this.approvals.set(sessionId, approval);
    void this.handleSessionLifecycle(sessionId);

    return {
      sessionId,
      uri,
      expiresAt: new Date(expiresAt).toISOString(),
      walletDelivery: 'qr',
    };
  }

  private async createEvmSwapSession(
    input: ICreateWalletConnectSessionInput,
  ): Promise<IWalletConnectSessionPublic> {
    this.ensureWalletConnectConfigured();
    const signClient = await this.getSignClient();
    const chainConfig = getWalletConnectChainConfig(input.swapPayload.chain);
    const { uri, approval } = await signClient.connect({
      requiredNamespaces: {
        [chainConfig.namespace]: {
          methods: [...chainConfig.methods],
          chains: [chainConfig.chainId],
          events: [...chainConfig.events],
        },
      },
    });

    if (!uri) {
      throw new BusinessException('Failed to create WalletConnect URI');
    }

    const sessionId = randomUUID();
    const expiresAt = Date.now() + this.swapTimeoutSeconds * 1_000;
    const session: IWalletConnectSession = {
      sessionId,
      userId: input.userId,
      uri,
      expiresAt,
      kind: 'swap',
      family: 'evm',
      chain: input.swapPayload.chain,
      swapPayload: { ...input.swapPayload },
    };

    this.sessionStore.save(session);
    this.approvals.set(sessionId, approval);
    void this.handleSessionLifecycle(sessionId);

    return {
      sessionId,
      uri,
      expiresAt: new Date(expiresAt).toISOString(),
      walletDelivery: 'qr',
    };
  }

  private ensureWalletConnectConfigured(): void {
    if (this.projectId.trim() === '') {
      throw new BusinessException('WC_PROJECT_ID is required for EVM /swap');
    }
  }

  private resolveTimeoutSeconds(): number {
    const rawTimeout = this.configService.get<string>('SWAP_TIMEOUT_SECONDS');
    const parsedTimeout = Number.parseInt(rawTimeout ?? `${DEFAULT_SWAP_TIMEOUT_SECONDS}`, 10);

    if (!Number.isInteger(parsedTimeout) || parsedTimeout < MIN_SWAP_TIMEOUT_SECONDS) {
      return DEFAULT_SWAP_TIMEOUT_SECONDS;
    }

    return parsedTimeout;
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
    this.sessionStore.saveConnection(
      saveWalletConnection({
        session,
        approvedSession,
        walletAddress,
      }),
    );

    if (session.kind === 'connect') {
      await this.notifyConnectedWallet(session, walletAddress);
      return;
    }

    await this.executeApprovedSwap(session, approvedSession, walletAddress);
  }

  private async notifyConnectedWallet(
    session: IWalletConnectSession,
    walletAddress: string,
  ): Promise<void> {
    await sendWalletConnectTelegramMessage({
      telegramBotToken: this.telegramBotToken,
      chatId: session.userId,
      text: [
        '👛 <b>Кошелёк подключён</b>',
        '',
        `🌐 Семейство: <code>${session.family === 'solana' ? 'Solana' : 'EVM'}</code>`,
        `🆔 Адрес: <code>${escapeWalletConnectHtml(walletAddress)}</code>`,
      ].join('\n'),
      logger: this.logger,
    });
  }

  private async executeApprovedSwap(
    session: IWalletConnectSession,
    approvedSession: SessionTypes.Struct,
    walletAddress: string,
  ): Promise<void> {
    const swapPayload = getWalletConnectSwapPayload(session);
    const aggregator = resolveWalletConnectAggregator(this.aggregators, swapPayload.aggregatorName);
    const transaction = await buildSwapTransactionForPayload(
      swapPayload,
      aggregator,
      walletAddress,
    );
    const transactionHash = await this.requestWalletExecution(
      approvedSession.topic,
      swapPayload.chain,
      walletAddress,
      transaction,
    );
    const explorerUrl = buildWalletExplorerUrl(
      this.configService,
      swapPayload.chain,
      transactionHash,
    );

    await sendWalletConnectTelegramMessage({
      telegramBotToken: this.telegramBotToken,
      chatId: session.userId,
      text: [
        '✅ <b>Своп отправлен</b>',
        '',
        `🌐 Сеть: <code>${escapeWalletConnectHtml(swapPayload.chain)}</code>`,
        `🏆 Агрегатор: <code>${escapeWalletConnectHtml(swapPayload.aggregatorName)}</code>`,
        `🧾 Tx: <code>${escapeWalletConnectHtml(transactionHash)}</code>`,
        `<a href="${escapeWalletConnectHtml(explorerUrl)}">Открыть в эксплорере</a>`,
      ].join('\n'),
      logger: this.logger,
    });
    await this.swapExecutionAuditService.markSuccess(
      swapPayload.executionId,
      swapPayload.aggregatorName,
      swapPayload.feeMode,
      transactionHash,
    );
  }

  private async handleSessionError(session: IWalletConnectSession, message: string): Promise<void> {
    const swapPayload = session.swapPayload;

    if (swapPayload) {
      await this.swapExecutionAuditService.markError(
        swapPayload.executionId,
        swapPayload.aggregatorName,
        swapPayload.feeMode,
        message,
      );
      await sendWalletConnectTelegramMessage({
        telegramBotToken: this.telegramBotToken,
        chatId: session.userId,
        text: `❌ <b>Ошибка:</b> ${escapeWalletConnectHtml(message)}`,
        logger: this.logger,
      });
      return;
    }

    await sendWalletConnectTelegramMessage({
      telegramBotToken: this.telegramBotToken,
      chatId: session.userId,
      text: `❌ <b>Ошибка:</b> ${escapeWalletConnectHtml(message)}`,
      logger: this.logger,
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
}
