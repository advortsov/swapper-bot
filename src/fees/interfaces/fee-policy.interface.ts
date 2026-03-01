import type { ChainType } from '../../chains/interfaces/chain.interface';

export type FeeMode = 'disabled' | 'enforced' | 'tracking_only';
export type FeeType = 'native fee' | 'partner fee' | 'no fee';
export type FeeAssetSide = 'buy' | 'sell' | 'none';

interface IBaseExecutionFeeConfig {
  aggregatorName: string;
  chain: ChainType;
  mode: FeeMode;
  feeType: FeeType;
  feeBps: number;
  feeAssetSide: FeeAssetSide;
  feeAssetAddress: string | null;
  feeAssetSymbol: string | null;
  feeAppliedAtQuote: boolean;
  feeEnforcedOnExecution: boolean;
}

export interface IDisabledExecutionFeeConfig extends IBaseExecutionFeeConfig {
  kind: 'none';
}

export interface IZeroXExecutionFeeConfig extends IBaseExecutionFeeConfig {
  kind: 'zerox';
  feeRecipient: string;
  feeTokenAddress: string;
}

export interface IParaSwapExecutionFeeConfig extends IBaseExecutionFeeConfig {
  kind: 'paraswap';
  partnerAddress: string;
  partnerName: string | null;
}

export interface IJupiterExecutionFeeConfig extends IBaseExecutionFeeConfig {
  kind: 'jupiter';
  feeAccount: string;
  feeMintAddress: string;
}

export type IExecutionFeeConfig =
  | IDisabledExecutionFeeConfig
  | IZeroXExecutionFeeConfig
  | IParaSwapExecutionFeeConfig
  | IJupiterExecutionFeeConfig;

export interface IFeePolicy {
  aggregatorName: string;
  chain: ChainType;
  mode: FeeMode;
  feeType: FeeType;
  feeBps: number;
  displayLabel: string;
  isEnabled: boolean;
  executionFee: IExecutionFeeConfig;
}
