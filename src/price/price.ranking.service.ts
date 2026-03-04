import { Injectable } from '@nestjs/common';

import type { IQuoteResponse } from '../aggregators/interfaces/aggregator.interface';

const AGGREGATOR_PRIORITY: Readonly<Record<string, number>> = {
  '0x': 0,
  paraswap: 1,
  odos: 2,
  jupiter: 3,
};

@Injectable()
export class PriceRankingService {
  public sortQuotes(quotes: readonly IQuoteResponse[]): readonly IQuoteResponse[] {
    return [...quotes].sort((leftQuote, rightQuote) => this.compareQuotes(leftQuote, rightQuote));
  }

  private compareQuotes(leftQuote: IQuoteResponse, rightQuote: IQuoteResponse): number {
    const leftAmount = BigInt(leftQuote.toAmountBaseUnits);
    const rightAmount = BigInt(rightQuote.toAmountBaseUnits);

    if (leftAmount > rightAmount) {
      return -1;
    }

    if (leftAmount < rightAmount) {
      return 1;
    }

    const leftGas = leftQuote.estimatedGasUsd ?? Number.POSITIVE_INFINITY;
    const rightGas = rightQuote.estimatedGasUsd ?? Number.POSITIVE_INFINITY;

    if (leftGas < rightGas) {
      return -1;
    }

    if (leftGas > rightGas) {
      return 1;
    }

    return (
      (AGGREGATOR_PRIORITY[leftQuote.aggregatorName] ?? Number.MAX_SAFE_INTEGER) -
      (AGGREGATOR_PRIORITY[rightQuote.aggregatorName] ?? Number.MAX_SAFE_INTEGER)
    );
  }
}
