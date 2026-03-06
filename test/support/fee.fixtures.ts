import type { IQuoteResponse } from '../../src/aggregators/interfaces/aggregator.interface';
import type { ChainType } from '../../src/chains/interfaces/chain.interface';
import type { IDisabledExecutionFeeConfig } from '../../src/fees/interfaces/fee-policy.interface';

export function createDisabledFeeConfig(
  aggregatorName: string,
  chain: ChainType,
): IDisabledExecutionFeeConfig {
  return {
    kind: 'none',
    aggregatorName,
    chain,
    mode: 'disabled',
    feeType: 'no fee',
    feeBps: 0,
    feeAssetSide: 'none',
    feeAssetAddress: null,
    feeAssetSymbol: null,
    feeAppliedAtQuote: false,
    feeEnforcedOnExecution: false,
  };
}

export function createQuoteResponse(input: {
  aggregatorName: string;
  chain: ChainType;
  toAmountBaseUnits: string;
  estimatedGasUsd: number | null;
}): IQuoteResponse {
  return {
    aggregatorName: input.aggregatorName,
    toAmountBaseUnits: input.toAmountBaseUnits,
    grossToAmountBaseUnits: input.toAmountBaseUnits,
    feeAmountBaseUnits: '0',
    feeAmountSymbol: null,
    feeAmountDecimals: null,
    feeBps: 0,
    feeMode: 'disabled',
    feeType: 'no fee',
    feeDisplayLabel: 'no fee',
    feeAppliedAtQuote: false,
    feeEnforcedOnExecution: false,
    feeAssetSide: 'none',
    executionFee: createDisabledFeeConfig(input.aggregatorName, input.chain),
    estimatedGasUsd: input.estimatedGasUsd,
    priceImpactPercent: null,
    routeHops: null,
    totalNetworkFeeWei: null,
    rawQuote: {},
  };
}
