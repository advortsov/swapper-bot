import type { ChainType } from '../../chains/interfaces/chain.interface';
import type {
  FeeAssetSide,
  FeeMode,
  FeeType,
  IExecutionFeeConfig,
} from '../../fees/interfaces/fee-policy.interface';

export interface IQuoteRequest {
  chain: ChainType;
  sellTokenAddress: string;
  buyTokenAddress: string;
  sellAmountBaseUnits: string;
  sellTokenDecimals: number;
  buyTokenDecimals: number;
  feeConfig: IExecutionFeeConfig;
}

export interface IQuoteResponse {
  aggregatorName: string;
  toAmountBaseUnits: string;
  grossToAmountBaseUnits: string;
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
  rawQuote: unknown;
}

export interface ISwapRequest {
  chain: ChainType;
  sellTokenAddress: string;
  buyTokenAddress: string;
  sellAmountBaseUnits: string;
  sellTokenDecimals: number;
  buyTokenDecimals: number;
  fromAddress: string;
  slippagePercentage: number;
  feeConfig: IExecutionFeeConfig;
}

export interface ISwapTransaction {
  kind: 'evm' | 'solana';
  to: string;
  data: string;
  value: string;
  serializedTransaction?: string;
  lastValidBlockHeight?: number;
}

export interface IAggregator {
  readonly name: string;
  readonly supportedChains: readonly ChainType[];

  getQuote(params: IQuoteRequest): Promise<IQuoteResponse>;
  buildSwapTransaction(params: ISwapRequest): Promise<ISwapTransaction>;
  healthCheck(): Promise<boolean>;
}
