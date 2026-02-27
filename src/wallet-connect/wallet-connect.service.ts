import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID } from 'node:crypto';

import { AGGREGATORS_TOKEN } from '../aggregators/aggregators.constants';
import type { IAggregator, ISwapTransaction } from '../aggregators/interfaces/aggregator.interface';
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
const SESSION_KEY_SIZE_BYTES = 32;

@Injectable()
export class WalletConnectService {
  private readonly projectId: string;
  private readonly swapTimeoutSeconds: number;
  private readonly swapSlippage: number;

  public constructor(
    private readonly configService: ConfigService,
    private readonly sessionStore: WalletConnectSessionStore,
    private readonly metricsService: MetricsService,
    @Inject(AGGREGATORS_TOKEN)
    private readonly aggregators: readonly IAggregator[],
  ) {
    this.projectId = this.configService.get<string>('WC_PROJECT_ID') ?? '';
    this.swapTimeoutSeconds = this.resolveTimeoutSeconds();
    this.swapSlippage = this.resolveSwapSlippage();
  }

  public createSession(input: ICreateWalletConnectSessionInput): IWalletConnectSessionPublic {
    this.ensureWalletConnectConfigured();

    const sessionId = randomUUID();
    const expiresAt = Date.now() + this.swapTimeoutSeconds * 1_000;
    const session: IWalletConnectSession = {
      sessionId,
      userId: input.userId,
      uri: this.buildWalletConnectUri(),
      expiresAt,
      swapPayload: {
        ...input.swapPayload,
        slippagePercentage: this.swapSlippage,
      },
    };

    this.sessionStore.save(session);
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
      const transaction = await aggregator.buildSwapTransaction({
        chain: session.swapPayload.chain,
        sellTokenAddress: session.swapPayload.sellTokenAddress,
        buyTokenAddress: session.swapPayload.buyTokenAddress,
        sellAmountBaseUnits: session.swapPayload.sellAmountBaseUnits,
        fromAddress: walletAddress,
        slippagePercentage: session.swapPayload.slippagePercentage,
      });

      this.sessionStore.delete(sessionId);
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

  private buildWalletConnectUri(): string {
    const topic = randomBytes(SESSION_KEY_SIZE_BYTES).toString('hex');
    const symmetricKey = randomBytes(SESSION_KEY_SIZE_BYTES).toString('hex');

    return `wc:${topic}@2?relay-protocol=irn&symKey=${symmetricKey}&projectId=${this.projectId}`;
  }
}
