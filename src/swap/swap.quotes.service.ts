import { Injectable } from '@nestjs/common';

import type { ISwapQuotesResponse, ISwapRequest } from './interfaces/swap.interface';
import { SwapIntentService } from './swap-intent.service';
import type { IPriceRequest } from '../price/interfaces/price.interface';
import { PriceQuoteService } from '../price/price.quote.service';

@Injectable()
export class SwapQuotesService {
  public constructor(
    private readonly priceQuoteService: PriceQuoteService,
    private readonly swapIntentService: SwapIntentService,
  ) {}

  public async getSwapQuotes(request: ISwapRequest): Promise<ISwapQuotesResponse> {
    const preparedInput = await this.priceQuoteService.prepare(
      this.toPriceRequest(request.userId, request),
    );
    const quoteSelection = await this.priceQuoteService.fetchQuoteSelection(preparedInput);
    const priceResponse = this.priceQuoteService.buildResponse(preparedInput, quoteSelection);
    const intent = await this.swapIntentService.createIntent(
      request,
      preparedInput,
      quoteSelection,
    );

    return {
      intentId: intent.intentId,
      chain: priceResponse.chain,
      aggregator: priceResponse.aggregator,
      fromSymbol: priceResponse.fromSymbol,
      toSymbol: priceResponse.toSymbol,
      fromTokenAddress: priceResponse.fromTokenAddress,
      toTokenAddress: priceResponse.toTokenAddress,
      fromAmount: priceResponse.fromAmount,
      toAmount: priceResponse.toAmount,
      grossToAmount: priceResponse.grossToAmount,
      feeAmount: priceResponse.feeAmount,
      feeAmountSymbol: priceResponse.feeAmountSymbol,
      feeBps: priceResponse.feeBps,
      feeMode: priceResponse.feeMode,
      feeType: priceResponse.feeType,
      feeDisplayLabel: priceResponse.feeDisplayLabel,
      providersPolled: priceResponse.providersPolled,
      quoteExpiresAt: intent.quoteExpiresAt,
      providerQuotes: this.swapIntentService.attachSelectionTokens(
        priceResponse.providerQuotes,
        intent.selectionTokens,
      ),
    };
  }

  private toPriceRequest(userId: string, request: ISwapRequest): IPriceRequest {
    return {
      userId,
      amount: request.amount,
      fromTokenInput: request.fromTokenInput,
      toTokenInput: request.toTokenInput,
      chain: request.chain,
      rawCommand: request.rawCommand,
      explicitChain: request.explicitChain,
    };
  }
}
