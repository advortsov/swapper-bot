import type { IZeroXQuoteResponse, IZeroXSwapTransaction } from './zero-x.types';
import type { IApprovalTargetResponse } from '../../allowance/interfaces/allowance.interface';
import { BusinessException } from '../../common/exceptions/business.exception';
import type { IQuoteRequest, IQuoteResponse } from '../interfaces/aggregator.interface';

export function isZeroXQuoteResponse(value: unknown): value is IZeroXQuoteResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record['buyAmount'] === 'string' &&
    typeof record['liquidityAvailable'] === 'boolean' &&
    (typeof record['totalNetworkFee'] === 'string' || record['totalNetworkFee'] === null)
  );
}

export function isZeroXSwapTransaction(value: unknown): value is IZeroXSwapTransaction {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record['to'] === 'string' &&
    typeof record['data'] === 'string' &&
    typeof record['value'] === 'string'
  );
}

export function toZeroXQuoteResponse(
  aggregatorName: string,
  params: IQuoteRequest,
  body: IZeroXQuoteResponse,
): IQuoteResponse {
  if (!body.liquidityAvailable) {
    throw new BusinessException('Недостаточно ликвидности для указанной пары');
  }

  const feeAmountBaseUnits = body.fees?.integratorFee?.amount ?? '0';
  const grossToAmountBaseUnits = resolveZeroXGrossToAmountBaseUnits(
    body.buyAmount,
    feeAmountBaseUnits,
    params.feeConfig,
  );

  return {
    aggregatorName,
    toAmountBaseUnits: body.buyAmount,
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
    totalNetworkFeeWei: body.totalNetworkFee,
    rawQuote: body,
  };
}

export function extractZeroXApprovalTarget(body: IZeroXQuoteResponse): IApprovalTargetResponse {
  const spenderAddress = body.allowanceTarget ?? body.transaction?.to ?? null;

  if (!spenderAddress || spenderAddress.trim() === '') {
    throw new BusinessException('0x allowanceTarget is missing');
  }

  return { spenderAddress };
}

export function resolveZeroXGrossToAmountBaseUnits(
  netToAmountBaseUnits: string,
  feeAmountBaseUnits: string,
  feeConfig: IQuoteRequest['feeConfig'],
): string {
  if (
    feeConfig.kind !== 'zerox' ||
    feeConfig.mode !== 'enforced' ||
    feeConfig.feeAssetSide !== 'buy' ||
    feeAmountBaseUnits === '0'
  ) {
    return netToAmountBaseUnits;
  }

  return (BigInt(netToAmountBaseUnits) + BigInt(feeAmountBaseUnits)).toString();
}
