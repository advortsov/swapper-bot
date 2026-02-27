import type { ChainType } from '../../chains/interfaces/chain.interface';

export interface IProviderQuote {
  aggregator: string;
  toAmount: string;
  estimatedGasUsd: number | null;
}

export interface IPriceRequest {
  chain: ChainType;
  userId: string;
  amount: string;
  fromSymbol: string;
  toSymbol: string;
  rawCommand: string;
}

export interface IPriceResponse {
  chain: ChainType;
  aggregator: string;
  fromSymbol: string;
  toSymbol: string;
  fromAmount: string;
  toAmount: string;
  estimatedGasUsd: number | null;
  providersPolled: number;
  providerQuotes: readonly IProviderQuote[];
}
