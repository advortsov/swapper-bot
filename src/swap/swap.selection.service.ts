import { Injectable } from '@nestjs/common';

import type {
  IConsumedSwapIntent,
  IStoredProviderQuoteSnapshot,
} from './interfaces/swap-intent.interface';
import { SwapIntentService } from './swap-intent.service';
import { BusinessException } from '../common/exceptions/business.exception';

@Injectable()
export class SwapSelectionService {
  public constructor(private readonly swapIntentService: SwapIntentService) {}

  public getSelectedQuote(consumedIntent: IConsumedSwapIntent): IStoredProviderQuoteSnapshot {
    const selectedQuote = consumedIntent.quoteSnapshot.providerQuotes.find(
      (quote) => quote.aggregatorName === consumedIntent.aggregator,
    );

    if (!selectedQuote) {
      throw new BusinessException('Selected aggregator is not available in swap intent');
    }

    return selectedQuote;
  }

  public async createExecution(input: {
    consumedIntent: IConsumedSwapIntent;
    selectedQuote: IStoredProviderQuoteSnapshot;
    slippage: number;
  }): Promise<string> {
    const swapPayloadHash = this.swapIntentService.hashPayload({
      intentId: input.consumedIntent.intentId,
      chain: input.consumedIntent.chain,
      aggregator: input.selectedQuote.aggregatorName,
      sellTokenAddress: input.consumedIntent.quoteSnapshot.fromToken.address,
      buyTokenAddress: input.consumedIntent.quoteSnapshot.toToken.address,
      sellAmountBaseUnits: input.consumedIntent.quoteSnapshot.sellAmountBaseUnits,
      slippage: input.slippage,
      feeConfig: input.selectedQuote.executionFee,
    });

    return this.swapIntentService.createExecution({
      intentId: input.consumedIntent.intentId,
      userId: input.consumedIntent.userId,
      chain: input.consumedIntent.chain,
      aggregator: input.selectedQuote.aggregatorName,
      feeMode: input.selectedQuote.feeMode,
      feeBps: input.selectedQuote.feeBps,
      feeRecipient: this.resolveFeeRecipient(input.selectedQuote),
      grossToAmount: input.selectedQuote.grossToAmountBaseUnits,
      botFeeAmount: input.selectedQuote.feeAmountBaseUnits,
      netToAmount: input.selectedQuote.netToAmountBaseUnits,
      quotePayloadHash: input.selectedQuote.rawQuoteHash,
      swapPayloadHash,
    });
  }

  private resolveFeeRecipient(quote: IStoredProviderQuoteSnapshot): string | null {
    if (quote.executionFee.kind === 'zerox') {
      return quote.executionFee.feeRecipient;
    }

    if (quote.executionFee.kind === 'paraswap') {
      return quote.executionFee.partnerAddress;
    }

    if (quote.executionFee.kind === 'jupiter') {
      return quote.executionFee.feeAccount;
    }

    return null;
  }
}
