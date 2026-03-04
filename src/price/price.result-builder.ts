import { Injectable } from '@nestjs/common';
import { formatUnits } from 'viem';

import type { IPriceResponse } from './interfaces/price.interface';
import type { IPreparedPriceInput, IQuoteSelection } from './price.quote.types';
import type { IQuoteResponse } from '../aggregators/interfaces/aggregator.interface';

@Injectable()
export class PriceResultBuilder {
  public buildResponse(input: IPreparedPriceInput, selection: IQuoteSelection): IPriceResponse {
    const providerQuotes = selection.successfulQuotes.map((quote) => ({
      aggregator: quote.aggregatorName,
      toAmount: formatUnits(BigInt(quote.toAmountBaseUnits), input.toToken.decimals),
      grossToAmount: formatUnits(BigInt(quote.grossToAmountBaseUnits), input.toToken.decimals),
      feeAmount: this.formatFeeAmount(quote),
      feeAmountSymbol: quote.feeAmountSymbol,
      feeBps: quote.feeBps,
      feeMode: quote.feeMode,
      feeType: quote.feeType,
      feeDisplayLabel: quote.feeDisplayLabel,
      feeAppliedAtQuote: quote.feeAppliedAtQuote,
      feeEnforcedOnExecution: quote.feeEnforcedOnExecution,
      estimatedGasUsd: quote.estimatedGasUsd,
    }));

    return {
      chain: input.chain,
      aggregator: selection.bestQuote.aggregatorName,
      fromSymbol: input.fromToken.symbol,
      toSymbol: input.toToken.symbol,
      fromTokenAddress: input.fromToken.address,
      toTokenAddress: input.toToken.address,
      fromAmount: input.normalizedAmount,
      toAmount: formatUnits(BigInt(selection.bestQuote.toAmountBaseUnits), input.toToken.decimals),
      grossToAmount: formatUnits(
        BigInt(selection.bestQuote.grossToAmountBaseUnits),
        input.toToken.decimals,
      ),
      feeAmount: this.formatFeeAmount(selection.bestQuote),
      feeAmountSymbol: selection.bestQuote.feeAmountSymbol,
      feeBps: selection.bestQuote.feeBps,
      feeMode: selection.bestQuote.feeMode,
      feeType: selection.bestQuote.feeType,
      feeDisplayLabel: selection.bestQuote.feeDisplayLabel,
      estimatedGasUsd: selection.bestQuote.estimatedGasUsd,
      providersPolled: selection.providersPolled,
      providerQuotes,
    };
  }

  private formatFeeAmount(quote: IQuoteResponse): string {
    if (quote.feeAmountDecimals === null) {
      return '0';
    }

    return formatUnits(BigInt(quote.feeAmountBaseUnits), quote.feeAmountDecimals);
  }
}
