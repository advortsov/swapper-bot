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
import { UserSettingsService } from '../settings/user-settings.service';

@Injectable()
export class SwapService {
  private readonly logger = new Logger(SwapService.name);

  @Inject()
  private readonly swapIntentService!: SwapIntentService;

  @Inject()
  private readonly swapExpirationService!: SwapExpirationService;

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
