import { describe, expect, it } from 'vitest';

import type {
  IAggregator,
  IQuoteRequest,
  IQuoteResponse,
  ISwapRequest,
  ISwapTransaction,
} from '../../src/aggregators/interfaces/aggregator.interface';
import { PriceProvidersService } from '../../src/price/price.providers.service';
import type { IPreparedPriceInput } from '../../src/price/price.quote.types';
import { createDisabledFeeConfig, createQuoteResponse } from '../support/fee.fixtures';

class FakeAggregator implements IAggregator {
  public calls = 0;

  public constructor(
    public readonly name: string,
    public readonly supportedChains: readonly (
      | 'ethereum'
      | 'arbitrum'
      | 'base'
      | 'optimism'
      | 'solana'
    )[],
    private readonly quote: IQuoteResponse | Error,
  ) {}

  public async getQuote(_params: IQuoteRequest): Promise<IQuoteResponse> {
    this.calls += 1;

    if (this.quote instanceof Error) {
      throw this.quote;
    }

    return this.quote;
  }

  public async buildSwapTransaction(_params: ISwapRequest): Promise<ISwapTransaction> {
    return { kind: 'evm', to: '', data: '', value: '0' };
  }

  public async healthCheck(): Promise<boolean> {
    return true;
  }
}

const preparedInput: IPreparedPriceInput = {
  chain: 'ethereum',
  normalizedAmount: '10',
  cacheKey: 'ethereum:a:b:10',
  fromToken: { address: '0x1', symbol: 'ETH', decimals: 18, name: 'Ether', chain: 'ethereum' },
  toToken: { address: '0x2', symbol: 'USDC', decimals: 6, name: 'USD Coin', chain: 'ethereum' },
  sellAmountBaseUnits: '10000000000000000000',
};

describe('PriceProvidersService', () => {
  it('должен фильтровать агрегаторы по preferred name', () => {
    const service = new PriceProvidersService(
      [
        new FakeAggregator(
          '0x',
          ['ethereum'],
          createQuoteResponse({
            aggregatorName: '0x',
            chain: 'ethereum',
            toAmountBaseUnits: '1000000',
            estimatedGasUsd: null,
          }),
        ),
        new FakeAggregator(
          'paraswap',
          ['ethereum'],
          createQuoteResponse({
            aggregatorName: 'paraswap',
            chain: 'ethereum',
            toAmountBaseUnits: '1001000',
            estimatedGasUsd: null,
          }),
        ),
      ],
      {
        getPolicy: (aggregatorName: string) => ({
          aggregatorName,
          chain: 'ethereum',
          mode: 'disabled',
          feeType: 'no fee',
          feeBps: 0,
          displayLabel: 'no fee',
          isEnabled: false,
          executionFee: createDisabledFeeConfig(aggregatorName, 'ethereum'),
        }),
        applyPolicy: ({ rawQuote }: { rawQuote: IQuoteResponse }) => rawQuote,
      } as never,
    );

    const aggregators = service.getAggregatorsToQuery('ethereum', 'zerox');

    expect(aggregators.map((aggregator) => aggregator.name)).toEqual(['0x']);
  });

  it('должен возвращать только успешные котировки', async () => {
    const service = new PriceProvidersService(
      [
        new FakeAggregator(
          '0x',
          ['ethereum'],
          createQuoteResponse({
            aggregatorName: '0x',
            chain: 'ethereum',
            toAmountBaseUnits: '1000000',
            estimatedGasUsd: null,
          }),
        ),
        new FakeAggregator('paraswap', ['ethereum'], new Error('failed')),
      ],
      {
        getPolicy: (aggregatorName: string) => ({
          aggregatorName,
          chain: 'ethereum',
          mode: 'disabled',
          feeType: 'no fee',
          feeBps: 0,
          displayLabel: 'no fee',
          isEnabled: false,
          executionFee: createDisabledFeeConfig(aggregatorName, 'ethereum'),
        }),
        applyPolicy: ({ rawQuote }: { rawQuote: IQuoteResponse }) => rawQuote,
      } as never,
    );

    const quotes = await service.fetchQuotes(
      service.getAggregatorsToQuery('ethereum'),
      preparedInput,
    );

    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.aggregatorName).toBe('0x');
  });
});
