import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BusinessException } from '../common/exceptions/business.exception';
import type { IPriceRequest } from '../price/interfaces/price.interface';
import { PriceQuoteService } from '../price/price.quote.service';
import { UserSettingsService } from '../settings/user-settings.service';
import type { ISwapRequest, ISwapSessionResponse } from './interfaces/swap.interface';
import { WalletConnectService } from '../wallet-connect/wallet-connect.service';

const DEFAULT_SWAP_SLIPPAGE = 0.5;

@Injectable()
export class SwapService {
  private readonly logger = new Logger(SwapService.name);
  private readonly fallbackSlippage: number;

  public constructor(
    private readonly configService: ConfigService,
    private readonly priceQuoteService: PriceQuoteService,
    private readonly walletConnectService: WalletConnectService,
    private readonly userSettingsService: UserSettingsService,
  ) {
    const rawSlippage = Number.parseFloat(
      this.configService.get<string>('SWAP_SLIPPAGE') ?? `${DEFAULT_SWAP_SLIPPAGE}`,
    );
    this.fallbackSlippage =
      Number.isFinite(rawSlippage) && rawSlippage > 0 ? rawSlippage : DEFAULT_SWAP_SLIPPAGE;
  }

  public async createSwapSession(request: ISwapRequest): Promise<ISwapSessionResponse> {
    const userSettings = await this.userSettingsService.getSettings(request.userId);
    const slippage = userSettings.slippage > 0 ? userSettings.slippage : this.fallbackSlippage;
    const preferredAggregator = userSettings.preferredAggregator;

    this.logger.log(
      `Swap session for user ${request.userId}: slippage=${slippage}%, aggregator=${preferredAggregator}`,
    );

    const preparedInput = await this.priceQuoteService.prepare(
      this.toPriceRequest(request.userId, request),
    );
    const quoteSelection = await this.priceQuoteService.fetchQuoteSelection(
      preparedInput,
      preferredAggregator,
    );
    const bestQuote = quoteSelection.bestQuote;

    if (bestQuote.toAmountBaseUnits.trim() === '') {
      throw new BusinessException('Best quote is empty');
    }

    const walletConnectSession = await this.walletConnectService.createSession({
      userId: request.userId,
      swapPayload: {
        chain: request.chain,
        aggregatorName: bestQuote.aggregatorName,
        sellTokenAddress: preparedInput.fromToken.address,
        buyTokenAddress: preparedInput.toToken.address,
        sellAmountBaseUnits: preparedInput.sellAmountBaseUnits,
        sellTokenDecimals: preparedInput.fromToken.decimals,
        buyTokenDecimals: preparedInput.toToken.decimals,
        slippagePercentage: slippage,
      },
    });

    const priceResponse = this.priceQuoteService.buildResponse(preparedInput, quoteSelection);

    return {
      chain: priceResponse.chain,
      aggregator: priceResponse.aggregator,
      fromSymbol: priceResponse.fromSymbol,
      toSymbol: priceResponse.toSymbol,
      fromAmount: priceResponse.fromAmount,
      toAmount: priceResponse.toAmount,
      providersPolled: priceResponse.providersPolled,
      providerQuotes: priceResponse.providerQuotes,
      walletConnectUri: walletConnectSession.uri,
      sessionId: walletConnectSession.sessionId,
      expiresAt: walletConnectSession.expiresAt,
    };
  }

  private toPriceRequest(userId: string, request: ISwapRequest): IPriceRequest {
    return {
      userId,
      amount: request.amount,
      fromSymbol: request.fromSymbol,
      toSymbol: request.toSymbol,
      chain: request.chain,
      rawCommand: request.rawCommand,
    };
  }
}
