import type { ChainType } from '../../chains/interfaces/chain.interface';
import type { FeeMode, FeeType } from '../../fees/interfaces/fee-policy.interface';
import type { IProviderQuote } from '../../price/interfaces/price.interface';

export interface ISwapRequest {
  chain: ChainType;
  userId: string;
  amount: string;
  fromTokenInput: string;
  toTokenInput: string;
  rawCommand: string;
  explicitChain: boolean;
}

export interface ISwapQuotesResponse {
  intentId: string;
  chain: ChainType;
  aggregator: string;
  fromSymbol: string;
  toSymbol: string;
  fromTokenAddress: string;
  toTokenAddress: string;
  fromAmount: string;
  toAmount: string;
  grossToAmount: string;
  feeAmount: string;
  feeAmountSymbol: string | null;
  feeBps: number;
  feeMode: FeeMode;
  feeType: FeeType;
  feeDisplayLabel: string;
  providersPolled: number;
  quoteExpiresAt: string;
  providerQuotes: readonly IProviderQuote[];
}

export interface ISwapSessionResponse {
  intentId: string;
  chain: ChainType;
  aggregator: string;
  fromSymbol: string;
  toSymbol: string;
  fromAmount: string;
  toAmount: string;
  grossToAmount: string;
  feeAmount: string;
  feeAmountSymbol: string | null;
  feeBps: number;
  feeMode: FeeMode;
  feeType: FeeType;
  feeDisplayLabel: string;
  walletConnectUri: string | null;
  sessionId: string;
  expiresAt: string;
  quoteExpiresAt: string;
  walletDelivery: 'qr' | 'app-link' | 'connected-wallet';
}
