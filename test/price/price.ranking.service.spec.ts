import { describe, expect, it } from 'vitest';

import { PriceRankingService } from '../../src/price/price.ranking.service';
import { createQuoteResponse } from '../support/fee.fixtures';

const service = new PriceRankingService();

describe('PriceRankingService', () => {
  it('должен ранжировать по максимальному toAmount и затем по gas и приоритету агрегатора', () => {
    const quotes = [
      createQuoteResponse({
        aggregatorName: 'paraswap',
        chain: 'ethereum',
        toAmountBaseUnits: '100',
        estimatedGasUsd: 2,
      }),
      createQuoteResponse({
        aggregatorName: '0x',
        chain: 'ethereum',
        toAmountBaseUnits: '100',
        estimatedGasUsd: 2,
      }),
      createQuoteResponse({
        aggregatorName: 'odos',
        chain: 'ethereum',
        toAmountBaseUnits: '99',
        estimatedGasUsd: 1,
      }),
    ];

    const sorted = service.sortQuotes(quotes);

    expect(sorted.map((quote) => quote.aggregatorName)).toEqual(['0x', 'paraswap', 'odos']);
  });
});
