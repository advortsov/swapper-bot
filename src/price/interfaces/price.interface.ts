import type { ChainType } from '../../chains/interfaces/chain.interface';
import type { FeeMode, FeeType } from '../../fees/interfaces/fee-policy.interface';

export interface IProviderQuote {
  aggregator: string;
  toAmount: string;
  grossToAmount: string;
  feeAmount: string;
  feeAmountSymbol: string | null;
  feeBps: number;
  feeMode: FeeMode;
  feeType: FeeType;
  feeDisplayLabel: string;
  feeAppliedAtQuote: boolean;
  feeEnforcedOnExecution: boolean;
  estimatedGasUsd: number | null;
  selectionToken?: string;
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
  grossToAmount: string;
  feeAmount: string;
  feeAmountSymbol: string | null;
  feeBps: number;
  feeMode: FeeMode;
  feeType: FeeType;
  feeDisplayLabel: string;
  estimatedGasUsd: number | null;
  providersPolled: number;
  providerQuotes: readonly IProviderQuote[];
}
