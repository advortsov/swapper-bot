import type { ChainType } from '../../chains/interfaces/chain.interface';
import type {
  FeeAssetSide,
  FeeMode,
  FeeType,
  IExecutionFeeConfig,
} from '../../fees/interfaces/fee-policy.interface';
import type { ITokenRecord } from '../../tokens/tokens.repository';

export interface IStoredProviderQuoteSnapshot {
  aggregatorName: string;
  grossToAmountBaseUnits: string;
  netToAmountBaseUnits: string;
  feeAmountBaseUnits: string;
  feeAmountSymbol: string | null;
  feeAmountDecimals: number | null;
  feeBps: number;
  feeMode: FeeMode;
  feeType: FeeType;
  feeDisplayLabel: string;
  feeAppliedAtQuote: boolean;
  feeEnforcedOnExecution: boolean;
  feeAssetSide: FeeAssetSide;
  executionFee: IExecutionFeeConfig;
  estimatedGasUsd: number | null;
  totalNetworkFeeWei: string | null;
  rawQuoteHash: string;
}

export interface ISwapQuoteSnapshot {
  chain: ChainType;
  normalizedAmount: string;
  sellAmountBaseUnits: string;
  fromToken: ITokenRecord;
  toToken: ITokenRecord;
  providerQuotes: readonly IStoredProviderQuoteSnapshot[];
}

export interface IConsumedSwapIntent {
  intentId: string;
  userId: string;
  chain: ChainType;
  rawCommand: string;
  aggregator: string;
  quoteExpiresAt: Date;
  quoteSnapshot: ISwapQuoteSnapshot;
}
