import { Injectable } from '@nestjs/common';

import type { IPriceRequest, IPriceResponse } from './interfaces/price.interface';
import { PriceProvidersService } from './price.providers.service';
import type { IPreparedPriceInput, IQuoteSelection } from './price.quote.types';
import { PriceRankingService } from './price.ranking.service';
import { PriceResultBuilder } from './price.result-builder';
import { PriceTokenResolutionService } from './price.token-resolution.service';
import { BusinessException } from '../common/exceptions/business.exception';

export type { IPreparedPriceInput, IQuoteSelection } from './price.quote.types';

@Injectable()
export class PriceQuoteService {
  public constructor(
    private readonly tokenResolutionService: PriceTokenResolutionService,
    private readonly providersService: PriceProvidersService,
    private readonly rankingService: PriceRankingService,
    private readonly resultBuilder: PriceResultBuilder,
  ) {}

  public async prepare(request: IPriceRequest): Promise<IPreparedPriceInput> {
    return this.tokenResolutionService.prepare(request);
  }

  public async fetchQuoteSelection(
    input: IPreparedPriceInput,
    preferredAggregator?: string,
  ): Promise<IQuoteSelection> {
    const aggregatorsToQuery = this.providersService.getAggregatorsToQuery(
      input.chain,
      preferredAggregator,
    );
    const quotes = await this.providersService.fetchQuotes(aggregatorsToQuery, input);

    if (quotes.length === 0) {
      throw new BusinessException('Failed to get quotes from all aggregators');
    }

    const sortedQuotes = this.rankingService.sortQuotes(quotes);
    const bestQuote = sortedQuotes[0];

    if (!bestQuote) {
      throw new BusinessException('Best quote is not available');
    }

    return {
      bestQuote,
      successfulQuotes: sortedQuotes,
      providersPolled: aggregatorsToQuery.length,
    };
  }

  public buildResponse(input: IPreparedPriceInput, selection: IQuoteSelection): IPriceResponse {
    return this.resultBuilder.buildResponse(input, selection);
  }
}
