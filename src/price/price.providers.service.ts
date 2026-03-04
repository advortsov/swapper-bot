import { Inject, Injectable } from '@nestjs/common';

import type { IPreparedPriceInput } from './price.quote.types';
import { AGGREGATORS_TOKEN } from '../aggregators/aggregators.constants';
import type { IAggregator, IQuoteResponse } from '../aggregators/interfaces/aggregator.interface';
import type { ChainType } from '../chains/interfaces/chain.interface';
import { BusinessException } from '../common/exceptions/business.exception';
import { QuoteMonetizationService } from '../fees/quote-monetization.service';

@Injectable()
export class PriceProvidersService {
  public constructor(
    @Inject(AGGREGATORS_TOKEN)
    private readonly aggregators: readonly IAggregator[],
    private readonly quoteMonetizationService: QuoteMonetizationService,
  ) {}

  public getAggregatorsToQuery(
    chain: ChainType,
    preferredAggregator?: string,
  ): readonly IAggregator[] {
    const chainAggregators = this.aggregators.filter((aggregator) =>
      aggregator.supportedChains.includes(chain),
    );

    if (chainAggregators.length === 0) {
      throw new BusinessException(`No aggregators configured for chain ${chain}`);
    }

    if (!preferredAggregator || preferredAggregator === 'auto') {
      return chainAggregators;
    }

    const normalizedPreference = preferredAggregator === 'zerox' ? '0x' : preferredAggregator;
    const preferred = chainAggregators.filter(
      (aggregator) => aggregator.name === normalizedPreference,
    );

    if (preferred.length === 0) {
      throw new BusinessException(
        `Aggregator ${preferredAggregator} is not configured for chain ${chain}`,
      );
    }

    return preferred;
  }

  public async fetchQuotes(
    aggregatorsToQuery: readonly IAggregator[],
    input: IPreparedPriceInput,
  ): Promise<readonly IQuoteResponse[]> {
    const settledQuotes = await Promise.allSettled(
      aggregatorsToQuery.map(async (aggregator) => this.fetchAggregatorQuote(aggregator, input)),
    );

    return settledQuotes.flatMap((result) => {
      if (result.status === 'fulfilled') {
        return [result.value];
      }

      return [];
    });
  }

  private async fetchAggregatorQuote(
    aggregator: IAggregator,
    input: IPreparedPriceInput,
  ): Promise<IQuoteResponse> {
    const feePolicy = this.quoteMonetizationService.getPolicy(
      aggregator.name,
      input.chain,
      input.fromToken,
      input.toToken,
    );
    const rawQuote = await aggregator.getQuote({
      chain: input.chain,
      sellTokenAddress: input.fromToken.address,
      buyTokenAddress: input.toToken.address,
      sellAmountBaseUnits: input.sellAmountBaseUnits,
      sellTokenDecimals: input.fromToken.decimals,
      buyTokenDecimals: input.toToken.decimals,
      feeConfig: feePolicy.executionFee,
    });

    return this.quoteMonetizationService.applyPolicy({
      rawQuote,
      feePolicy,
      fromToken: input.fromToken,
      toToken: input.toToken,
      sellAmountBaseUnits: input.sellAmountBaseUnits,
    });
  }
}
