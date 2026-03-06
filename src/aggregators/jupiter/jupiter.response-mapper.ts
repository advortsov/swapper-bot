import type { IExecutionFeeConfig } from '../../fees/interfaces/fee-policy.interface';
import type { IQuoteRequest, IQuoteResponse } from '../interfaces/aggregator.interface';

export interface IJupiterQuoteResponse {
  outAmount: string;
  priceImpactPct?: string;
  platformFee?: {
    amount: string;
  };
}

export interface IJupiterSwapResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
}

export function isJupiterQuoteResponse(value: unknown): value is IJupiterQuoteResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate['outAmount'] === 'string';
}

export function isJupiterSwapResponse(value: unknown): value is IJupiterSwapResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['swapTransaction'] === 'string' &&
    typeof candidate['lastValidBlockHeight'] === 'number'
  );
}

export function resolveJupiterGrossToAmountBaseUnits(
  netToAmountBaseUnits: string,
  feeAmountBaseUnits: string,
  feeConfig: IExecutionFeeConfig,
): string {
  if (
    feeConfig.kind !== 'jupiter' ||
    feeConfig.mode !== 'enforced' ||
    feeConfig.feeAssetSide !== 'buy' ||
    feeAmountBaseUnits === '0'
  ) {
    return netToAmountBaseUnits;
  }

  return (BigInt(netToAmountBaseUnits) + BigInt(feeAmountBaseUnits)).toString();
}

export function toJupiterQuoteResponse(
  aggregatorName: string,
  params: IQuoteRequest,
  responseBody: IJupiterQuoteResponse,
): IQuoteResponse {
  const feeAmountBaseUnits = responseBody.platformFee?.amount ?? '0';
  const grossToAmountBaseUnits = resolveJupiterGrossToAmountBaseUnits(
    responseBody.outAmount,
    feeAmountBaseUnits,
    params.feeConfig,
  );

  return {
    aggregatorName,
    toAmountBaseUnits: responseBody.outAmount,
    grossToAmountBaseUnits,
    feeAmountBaseUnits,
    feeAmountSymbol: null,
    feeAmountDecimals: null,
    feeBps: 0,
    feeMode: 'disabled',
    feeType: 'no fee',
    feeDisplayLabel: 'no fee',
    feeAppliedAtQuote: false,
    feeEnforcedOnExecution: false,
    feeAssetSide: 'none',
    executionFee: params.feeConfig,
    estimatedGasUsd: null,
    priceImpactPercent: parseJupiterPriceImpact(responseBody.priceImpactPct),
    routeHops: null,
    totalNetworkFeeWei: null,
    rawQuote: responseBody,
  };
}

export function parseJupiterPriceImpact(value: string | undefined): number | null {
  if (value === undefined) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}
