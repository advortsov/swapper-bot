import type { IQuoteResponse } from '../aggregators/interfaces/aggregator.interface';
import type { ChainType } from '../chains/interfaces/chain.interface';
import type { ITokenRecord } from '../tokens/tokens.repository';

export interface IQuoteSelection {
  bestQuote: IQuoteResponse;
  successfulQuotes: readonly IQuoteResponse[];
  providersPolled: number;
}

export interface IPreparedPriceInput {
  chain: ChainType;
  normalizedAmount: string;
  cacheKey: string;
  fromToken: ITokenRecord;
  toToken: ITokenRecord;
  sellAmountBaseUnits: string;
}
