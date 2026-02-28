import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import SignClient from '@walletconnect/sign-client';
import type { SessionTypes } from '@walletconnect/types';
import { randomUUID } from 'node:crypto';

import { AGGREGATORS_TOKEN } from '../aggregators/aggregators.constants';
import type { IAggregator, ISwapTransaction } from '../aggregators/interfaces/aggregator.interface';
import type { ChainType } from '../chains/interfaces/chain.interface';
import { BusinessException } from '../common/exceptions/business.exception';
import { MetricsService } from '../metrics/metrics.service';
import type {
  ICreateWalletConnectSessionInput,
  IPhantomCallbackQuery,
  IWalletConnectSession,
  IWalletConnectSessionPublic,
} from './interfaces/wallet-connect.interface';
import {
  CHAIN_CONFIG_BY_CHAIN,
  DEFAULT_APP_PUBLIC_URL,
  MIN_SWAP_TIMEOUT_SECONDS,
  TELEGRAM_API_BASE_URL,
  type IWalletConnectChainConfig,
  WALLETCONNECT_ICON_URL,
} from './wallet-connect.constants';
import { WalletConnectPhantomService } from './wallet-connect.phantom.service';
import { WalletConnectSessionStore } from './wallet-connect.session-store';

const DEFAULT_SWAP_TIMEOUT_SECONDS = 300;
const TELEGRAM_PREVIEW_DISABLED = true;

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
    private readonly metricsService: MetricsService,
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
      metadata: this.getClientMetadata(),
    });
    this.registerClientEvents(this.signClient);
  }

  public async createSession(
    input: ICreateWalletConnectSessionInput,
  ): Promise<IWalletConnectSessionPublic> {
    if (input.swapPayload.chain === 'solana') {
      return this.phantomService.createSession(input);
    }

    this.ensureWalletConnectConfigured();
    const signClient = await this.getSignClient();
    const chainConfig = this.getChainConfig(input.swapPayload.chain);
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
      swapPayload: {
        ...input.swapPayload,
      },
    };

    this.sessionStore.save(session);
    this.approvals.set(sessionId, approval);
    this.metricsService.incrementSwapRequest('initiated');
    void this.handleSessionLifecycle(sessionId);

    return {
      sessionId: session.sessionId,
      uri: session.uri,
      expiresAt: new Date(session.expiresAt).toISOString(),
    };
  }

  public getPhantomConnectUrl(sessionId: string): string {
    return this.phantomService.getPhantomConnectUrl(sessionId);
  }

  public async handlePhantomConnectCallback(query: IPhantomCallbackQuery): Promise<string> {
    return this.phantomService.handleConnectCallback(query);
  }

  public async handlePhantomSignCallback(
    query: IPhantomCallbackQuery,
  ): Promise<{ explorerUrl: string; transactionHash: string }> {
    return this.phantomService.handleSignCallback(query);
  }

  public async buildSwapTransaction(
    sessionId: string,
    walletAddress: string,
  ): Promise<ISwapTransaction> {
    const session = this.sessionStore.get(sessionId);

    if (!session) {
      this.metricsService.incrementSwapRequest('error');
      throw new BusinessException('WalletConnect session is not found or expired');
    }

    if (session.swapPayload.chain === 'solana') {
      return this.phantomService.buildSwapTransaction(sessionId, walletAddress);
    }

    const aggregator = this.resolveAggregator(session.swapPayload.aggregatorName);

    try {
      await this.waitForApproval(sessionId, session.expiresAt);
      const transaction = await this.buildTransactionForSession(session, aggregator, walletAddress);

      this.sessionStore.delete(sessionId);
      this.approvals.delete(sessionId);
      this.metricsService.incrementSwapRequest('success');

      return transaction;
    } catch (error: unknown) {
      this.metricsService.incrementSwapRequest('error');
      throw error;
    }
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
      metadata: this.getClientMetadata(),
    });
    this.registerClientEvents(this.signClient);

    return this.signClient;
  }

  private getClientMetadata(): {
    name: string;
    description: string;
    url: string;
    icons: string[];
    redirect: { universal: string };
  } {
    return {
      name: 'swapper-bot',
      description: 'DEX Aggregator Telegram Bot',
      url: this.appPublicUrl,
      icons: [WALLETCONNECT_ICON_URL],
      redirect: {
        universal: this.appPublicUrl,
      },
    };
  }

  private async waitForApproval(
    sessionId: string,
    expiresAt: number,
  ): Promise<SessionTypes.Struct> {
    const approvalCallback = this.approvals.get(sessionId);

    if (!approvalCallback) {
      throw new BusinessException('WalletConnect approval promise is not available');
    }

    const timeout = Math.max(expiresAt - Date.now(), 1);
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      setTimeout(() => {
        reject(new BusinessException('WalletConnect approval timed out'));
      }, timeout);
    });

    return Promise.race([approvalCallback(), timeoutPromise]);
  }

  private async handleSessionLifecycle(sessionId: string): Promise<void> {
    const session = this.sessionStore.get(sessionId);

    if (!session) {
      return;
    }

    try {
      const approvedSession = await this.waitForApproval(sessionId, session.expiresAt);
      const walletAddress = this.extractWalletAddress(approvedSession, session.swapPayload.chain);
      const aggregator = this.resolveAggregator(session.swapPayload.aggregatorName);
      const transaction = await this.buildTransactionForSession(session, aggregator, walletAddress);
      const transactionHash = await this.requestWalletExecution(
        approvedSession,
        session.swapPayload.chain,
        walletAddress,
        transaction,
      );
      const explorerUrl = this.buildExplorerUrl(session.swapPayload.chain, transactionHash);

      await this.sendTelegramMessage(
        session.userId,
        [
          'Своп отправлен.',
          `Сеть: ${session.swapPayload.chain}`,
          `Агрегатор: ${session.swapPayload.aggregatorName}`,
          `Tx: <code>${this.escapeHtml(transactionHash)}</code>`,
          `<a href="${explorerUrl}">Открыть в эксплорере</a>`,
        ].join('\n'),
      );
      this.metricsService.incrementSwapRequest('success');
    } catch (error: unknown) {
      const message = this.getErrorMessage(error);
      this.logger.error(`WalletConnect swap failed: ${message}`);
      this.metricsService.incrementSwapRequest('error');
      await this.sendTelegramMessage(session.userId, `Ошибка свопа: ${this.escapeHtml(message)}`);
    } finally {
      this.sessionStore.delete(sessionId);
      this.approvals.delete(sessionId);
    }
  }

  private registerClientEvents(signClient: SignClient): void {
    if (signClient.events.listenerCount('session_connect') === 0) {
      signClient.on('session_connect', ({ session }) => {
        this.logger.log(`WalletConnect session connected: ${session.topic}`);
      });
    }

    if (signClient.events.listenerCount('session_expire') === 0) {
      signClient.on('session_expire', ({ topic }) => {
        this.logger.warn(`WalletConnect session expired: ${topic}`);
      });
    }

    if (signClient.events.listenerCount('session_delete') === 0) {
      signClient.on('session_delete', ({ topic }) => {
        this.logger.warn(`WalletConnect session deleted: ${topic}`);
      });
    }
  }

  private getChainConfig(chain: ChainType): IWalletConnectChainConfig {
    return CHAIN_CONFIG_BY_CHAIN[chain];
  }

  private resolveAggregator(aggregatorName: string): IAggregator {
    const aggregator = this.aggregators.find(
      (candidateAggregator) => candidateAggregator.name === aggregatorName,
    );

    if (!aggregator) {
      throw new BusinessException(`Aggregator ${aggregatorName} is not available for swap`);
    }

    return aggregator;
  }

  private buildTransactionForSession(
    session: IWalletConnectSession,
    aggregator: IAggregator,
    walletAddress: string,
  ): Promise<ISwapTransaction> {
    return aggregator.buildSwapTransaction({
      chain: session.swapPayload.chain,
      sellTokenAddress: session.swapPayload.sellTokenAddress,
      buyTokenAddress: session.swapPayload.buyTokenAddress,
      sellAmountBaseUnits: session.swapPayload.sellAmountBaseUnits,
      sellTokenDecimals: session.swapPayload.sellTokenDecimals,
      buyTokenDecimals: session.swapPayload.buyTokenDecimals,
      fromAddress: walletAddress,
      slippagePercentage: session.swapPayload.slippagePercentage,
    });
  }

  private extractWalletAddress(session: SessionTypes.Struct, chain: ChainType): string {
    const chainConfig = this.getChainConfig(chain);
    const accounts = session.namespaces[chainConfig.namespace]?.accounts ?? [];
    const account = accounts[0];

    if (!account) {
      throw new BusinessException(`WalletConnect session for ${chain} does not contain accounts`);
    }

    const walletAddress = account.split(':').at(-1);

    if (!walletAddress) {
      throw new BusinessException(`WalletConnect account format is invalid for ${chain}`);
    }

    return walletAddress;
  }

  private async requestWalletExecution(
    session: SessionTypes.Struct,
    chain: ChainType,
    walletAddress: string,
    transaction: ISwapTransaction,
  ): Promise<string> {
    const signClient = await this.getSignClient();
    const chainConfig = this.getChainConfig(chain);

    if (transaction.kind === 'solana') {
      const serializedTransaction = transaction.serializedTransaction;

      if (!serializedTransaction) {
        throw new BusinessException('Solana transaction payload is missing');
      }

      const result = await signClient.request({
        topic: session.topic,
        chainId: chainConfig.chainId,
        request: {
          method: 'solana_signAndSendTransaction',
          params: {
            transaction: serializedTransaction,
          },
        },
      });

      return this.parseTransactionResult(result);
    }

    const result = await signClient.request({
      topic: session.topic,
      chainId: chainConfig.chainId,
      request: {
        method: 'eth_sendTransaction',
        params: [
          {
            from: walletAddress,
            to: transaction.to,
            data: transaction.data,
            value: transaction.value,
          },
        ],
      },
    });

    return this.parseTransactionResult(result);
  }

  private parseTransactionResult(result: unknown): string {
    if (typeof result === 'string' && result.trim() !== '') {
      return result;
    }

    if (typeof result === 'object' && result !== null) {
      const candidate = result as Record<string, unknown>;

      if (typeof candidate['signature'] === 'string' && candidate['signature'].trim() !== '') {
        return candidate['signature'];
      }

      if (typeof candidate['txHash'] === 'string' && candidate['txHash'].trim() !== '') {
        return candidate['txHash'];
      }
    }

    throw new BusinessException('WalletConnect transaction result is invalid');
  }

  private buildExplorerUrl(chain: ChainType, transactionHash: string): string {
    const explorerUrlByChain: Readonly<Record<ChainType, string>> = {
      ethereum:
        this.configService.get<string>('EXPLORER_URL_ETHEREUM') ?? 'https://etherscan.io/tx/',
      arbitrum:
        this.configService.get<string>('EXPLORER_URL_ARBITRUM') ?? 'https://arbiscan.io/tx/',
      base: this.configService.get<string>('EXPLORER_URL_BASE') ?? 'https://basescan.org/tx/',
      optimism:
        this.configService.get<string>('EXPLORER_URL_OPTIMISM') ??
        'https://optimistic.etherscan.io/tx/',
      solana: this.configService.get<string>('EXPLORER_URL_SOLANA') ?? 'https://solscan.io/tx/',
    };

    const baseUrl = explorerUrlByChain[chain];

    if (baseUrl.trim() === '') {
      throw new BusinessException(`Explorer URL for chain ${chain} is not configured`);
    }

    return `${baseUrl}${transactionHash}`;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof BusinessException) {
      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    // WalletConnect errors often come as plain objects
    if (typeof error === 'object' && error !== null) {
      const errorObj = error as Record<string, unknown>;

      // Log the full error object for debugging
      this.logger.error(`Full error object: ${JSON.stringify(errorObj)}`);

      if (typeof errorObj['message'] === 'string') {
        return errorObj['message'];
      }

      if (typeof errorObj['code'] === 'string') {
        return `WalletConnect error: ${errorObj['code']}`;
      }

      if (typeof errorObj['data'] === 'string') {
        return `WalletConnect error: ${errorObj['data']}`;
      }
    }

    if (typeof error === 'string') {
      return error;
    }

    return 'Unknown internal error';
  }

  private async sendTelegramMessage(chatId: string, text: string): Promise<void> {
    if (this.telegramBotToken.trim() === '') {
      return;
    }

    const response = await fetch(
      `${TELEGRAM_API_BASE_URL}/bot${this.telegramBotToken}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: TELEGRAM_PREVIEW_DISABLED,
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      this.logger.warn(`Telegram sendMessage failed: ${response.status} ${body}`);
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }
}
