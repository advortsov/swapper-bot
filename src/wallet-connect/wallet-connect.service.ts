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
  IWalletConnectSession,
  IWalletConnectSessionPublic,
} from './interfaces/wallet-connect.interface';
import { WalletConnectSessionStore } from './wallet-connect.session-store';

const DEFAULT_SWAP_TIMEOUT_SECONDS = 300;
const MIN_SWAP_TIMEOUT_SECONDS = 1;
const DEFAULT_SWAP_SLIPPAGE = 0.5;
const DEFAULT_APP_PUBLIC_URL = 'https://example.org';
type IEvmChainType = Exclude<ChainType, 'solana'>;

const CHAIN_NAMESPACE_BY_CHAIN: Readonly<Record<IEvmChainType, string>> = {
  ethereum: 'eip155:1',
  arbitrum: 'eip155:42161',
  base: 'eip155:8453',
  optimism: 'eip155:10',
};
const WALLETCONNECT_ICON_URL = 'https://walletconnect.com/walletconnect-logo.png';
const WALLETCONNECT_METHODS = [
  'eth_sendTransaction',
  'eth_signTransaction',
  'personal_sign',
  'eth_signTypedData',
  'eth_signTypedData_v4',
];
const WALLETCONNECT_EVENTS = ['accountsChanged', 'chainChanged'];

@Injectable()
export class WalletConnectService implements OnModuleInit {
  private readonly logger = new Logger(WalletConnectService.name);
  private readonly projectId: string;
  private readonly appPublicUrl: string;
  private readonly swapTimeoutSeconds: number;
  private readonly swapSlippage: number;
  private signClient: SignClient | null = null;
  private readonly approvals = new Map<string, () => Promise<SessionTypes.Struct>>();

  public constructor(
    private readonly configService: ConfigService,
    private readonly sessionStore: WalletConnectSessionStore,
    private readonly metricsService: MetricsService,
    @Inject(AGGREGATORS_TOKEN)
    private readonly aggregators: readonly IAggregator[],
  ) {
    this.projectId = this.configService.get<string>('WC_PROJECT_ID') ?? '';
    this.appPublicUrl = this.configService.get<string>('APP_PUBLIC_URL') ?? DEFAULT_APP_PUBLIC_URL;
    this.swapTimeoutSeconds = this.resolveTimeoutSeconds();
    this.swapSlippage = this.resolveSwapSlippage();
  }

  public async onModuleInit(): Promise<void> {
    if (this.projectId.trim() === '') {
      this.logger.warn('WalletConnect is disabled: WC_PROJECT_ID is empty');
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
    this.ensureWalletConnectConfigured();
    if (input.swapPayload.chain === 'solana') {
      throw new BusinessException('WalletConnect для Solana пока не поддерживается');
    }

    const signClient = await this.getSignClient();
    const { uri, approval } = await signClient.connect({
      requiredNamespaces: {
        eip155: {
          methods: WALLETCONNECT_METHODS,
          chains: [CHAIN_NAMESPACE_BY_CHAIN[input.swapPayload.chain]],
          events: WALLETCONNECT_EVENTS,
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
        slippagePercentage: this.swapSlippage,
      },
    };

    this.sessionStore.save(session);
    this.approvals.set(sessionId, approval);
    this.metricsService.incrementSwapRequest('initiated');

    return {
      sessionId: session.sessionId,
      uri: session.uri,
      expiresAt: new Date(session.expiresAt).toISOString(),
    };
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

    const aggregator = this.aggregators.find(
      (candidateAggregator) => candidateAggregator.name === session.swapPayload.aggregatorName,
    );

    if (!aggregator) {
      this.metricsService.incrementSwapRequest('error');
      throw new BusinessException(
        `Aggregator ${session.swapPayload.aggregatorName} is not available for swap`,
      );
    }

    try {
      await this.waitForApproval(sessionId, session.expiresAt);

      const transaction = await aggregator.buildSwapTransaction({
        chain: session.swapPayload.chain,
        sellTokenAddress: session.swapPayload.sellTokenAddress,
        buyTokenAddress: session.swapPayload.buyTokenAddress,
        sellAmountBaseUnits: session.swapPayload.sellAmountBaseUnits,
        sellTokenDecimals: session.swapPayload.sellTokenDecimals,
        buyTokenDecimals: session.swapPayload.buyTokenDecimals,
        fromAddress: walletAddress,
        slippagePercentage: session.swapPayload.slippagePercentage,
      });

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
      throw new BusinessException('WC_PROJECT_ID is required for /swap');
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

  private resolveSwapSlippage(): number {
    const rawSlippage = this.configService.get<string>('SWAP_SLIPPAGE');
    const parsedSlippage = Number.parseFloat(rawSlippage ?? `${DEFAULT_SWAP_SLIPPAGE}`);

    if (!Number.isFinite(parsedSlippage) || parsedSlippage <= 0) {
      return DEFAULT_SWAP_SLIPPAGE;
    }

    return parsedSlippage;
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
  } {
    return {
      name: 'swapper-bot',
      description: 'DEX Aggregator Telegram Bot',
      url: this.appPublicUrl,
      icons: [WALLETCONNECT_ICON_URL],
    };
  }

  private async waitForApproval(sessionId: string, expiresAt: number): Promise<void> {
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

    await Promise.race([approvalCallback(), timeoutPromise]);
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
}
