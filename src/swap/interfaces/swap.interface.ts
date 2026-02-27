import type { ChainType } from '../../chains/interfaces/chain.interface';
import type { IProviderQuote } from '../../price/interfaces/price.interface';

export interface ISwapRequest {
  chain: ChainType;
  userId: string;
  amount: string;
  fromSymbol: string;
  toSymbol: string;
  rawCommand: string;
}

export interface ISwapSessionResponse {
  chain: ChainType;
  aggregator: string;
  fromSymbol: string;
  toSymbol: string;
  fromAmount: string;
  toAmount: string;
  providersPolled: number;
  providerQuotes: readonly IProviderQuote[];
  walletConnectUri: string;
  sessionId: string;
  expiresAt: string;
}
