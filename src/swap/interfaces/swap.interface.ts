import type { IProviderQuote } from '../../price/interfaces/price.interface';

export interface ISwapRequest {
  userId: string;
  amount: string;
  fromSymbol: string;
  toSymbol: string;
  rawCommand: string;
}

export interface ISwapSessionResponse {
  chain: string;
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
