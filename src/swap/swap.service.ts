import { Inject, Injectable, Logger } from '@nestjs/common';

import type {
  ISwapQuotesResponse,
  ISwapRequest,
  ISwapSessionResponse,
} from './interfaces/swap.interface';
import { SwapIntentService } from './swap-intent.service';
import { SwapExpirationService } from './swap.expiration.service';
import { SwapQuotesService } from './swap.quotes.service';
import { SwapSelectionService } from './swap.selection.service';
import { SwapSessionService } from './swap.session.service';
import type { MetricsService } from '../metrics/metrics.service';
import { HighRiskRouteException } from '../route-safety/high-risk-route.exception';
import { RouteBlockedException } from '../route-safety/route-blocked.exception';
import type { RouteRiskService } from '../route-safety/route-risk.service';
import { UserSettingsService } from '../settings/user-settings.service';

@Injectable()
export class SwapService {
  private readonly logger = new Logger(SwapService.name);

  @Inject()
  private readonly swapIntentService!: SwapIntentService;

  @Inject()
  private readonly swapExpirationService!: SwapExpirationService;

  @Inject()
  private readonly routeRiskService!: RouteRiskService;

  @Inject()
  private readonly metricsService!: MetricsService;

  public constructor(
    private readonly swapQuotesService: SwapQuotesService,
    private readonly userSettingsService: UserSettingsService,
    private readonly swapSelectionService: SwapSelectionService,
    private readonly swapSessionService: SwapSessionService,
  ) {}

  public async getSwapQuotes(request: ISwapRequest): Promise<ISwapQuotesResponse> {
    return this.swapQuotesService.getSwapQuotes(request);
  }

  public async createSwapSessionFromSelection(
    userId: string,
    selectionToken: string,
  ): Promise<ISwapSessionResponse> {
    const consumedIntent = await this.swapIntentService.consumeSelectionToken(
      userId,
      selectionToken,
    );
    const userSettings = await this.userSettingsService.getSettings(userId);
    const slippage = this.swapExpirationService.resolveSlippage(userSettings.slippage);
    const selectedQuote = this.swapSelectionService.getSelectedQuote(consumedIntent);

    const riskAssessment = this.routeRiskService.evaluate({
      slippagePercentage: slippage,
      estimatedGasUsd: selectedQuote.estimatedGasUsd,
      priceImpactPercent: selectedQuote.priceImpactPercent,
      routeHops: selectedQuote.routeHops,
      chain: consumedIntent.chain,
    });

    this.metricsService.incrementRouteRiskEvaluation(riskAssessment.level, consumedIntent.chain);

    if (riskAssessment.level === 'blocked') {
      this.metricsService.incrementRouteRiskBlocked(consumedIntent.chain);
      throw new RouteBlockedException(riskAssessment);
    }

    if (riskAssessment.level === 'high') {
      const confirmToken = this.swapIntentService.storeRiskConfirmation({
        userId,
        consumedIntent,
        selectedQuote,
        slippage,
      });
      throw new HighRiskRouteException(riskAssessment, confirmToken);
    }

    return this.executeSwapSession({ userId, consumedIntent, selectedQuote, slippage });
  }

  public async confirmRiskySwap(
    userId: string,
    confirmToken: string,
  ): Promise<ISwapSessionResponse> {
    const stored = this.swapIntentService.consumeRiskConfirmation(userId, confirmToken);

    return this.executeSwapSession({
      userId,
      consumedIntent: stored.consumedIntent,
      selectedQuote: stored.selectedQuote,
      slippage: stored.slippage,
    });
  }

  private async executeSwapSession(input: {
    userId: string;
    consumedIntent: Parameters<SwapSelectionService['createExecution']>[0]['consumedIntent'];
    selectedQuote: Parameters<SwapSelectionService['createExecution']>[0]['selectedQuote'];
    slippage: number;
  }): Promise<ISwapSessionResponse> {
    const { userId, consumedIntent, selectedQuote, slippage } = input;

    const executionId = await this.swapSelectionService.createExecution({
      consumedIntent,
      selectedQuote,
      slippage,
    });

    this.logger.log(
      `Swap session for user ${userId}: slippage=${slippage}%, aggregator=${selectedQuote.aggregatorName}`,
    );
    const walletConnectSession = await this.swapSessionService.createWalletConnectSession({
      userId,
      executionId,
      slippage,
      consumedIntent,
      selectedQuote,
    });
    await this.swapSessionService.attachProviderReference(
      executionId,
      walletConnectSession.sessionId,
    );

    return this.swapSessionService.buildResponse({
      consumedIntent,
      selectedQuote,
      walletConnectSession,
      quoteExpiresAt: this.swapExpirationService.formatQuoteExpiresAt(
        consumedIntent.quoteExpiresAt,
      ),
    });
  }
}
