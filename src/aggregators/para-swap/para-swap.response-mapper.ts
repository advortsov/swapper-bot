import {
  ZERO_BIGINT,
  type IParaSwapQuoteResponse,
  type IParaSwapTransactionResponse,
} from './para-swap.types';
import type { IApprovalTargetResponse } from '../../allowance/interfaces/allowance.interface';
import { BusinessException } from '../../common/exceptions/business.exception';
import type { IQuoteRequest, IQuoteResponse } from '../interfaces/aggregator.interface';

export function isParaSwapQuoteResponse(value: unknown): value is IParaSwapQuoteResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const priceRoute = record['priceRoute'];

  if (typeof priceRoute !== 'object' || priceRoute === null) {
    return false;
  }

  const routeRecord = priceRoute as Record<string, unknown>;
  const gasCostUSD = routeRecord['gasCostUSD'];

  return (
    typeof routeRecord['destAmount'] === 'string' &&
    (gasCostUSD === undefined || typeof gasCostUSD === 'string')
  );
}

export function isParaSwapTransactionResponse(
  value: unknown,
): value is IParaSwapTransactionResponse {
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

export function toParaSwapQuoteResponse(
  aggregatorName: string,
  params: IQuoteRequest,
  body: IParaSwapQuoteResponse,
): IQuoteResponse {
  ensurePositiveParaSwapAmount(body.priceRoute.destAmount);

  return {
    aggregatorName,
    toAmountBaseUnits: body.priceRoute.destAmount,
    grossToAmountBaseUnits: body.priceRoute.destAmount,
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
    executionFee: params.feeConfig,
    estimatedGasUsd: parseParaSwapGasUsd(body.priceRoute.gasCostUSD),
    totalNetworkFeeWei: null,
    rawQuote: body,
  };
}

export function extractParaSwapApprovalTarget(
  body: IParaSwapQuoteResponse,
): IApprovalTargetResponse {
  const spenderAddress =
    body.priceRoute.tokenTransferProxy ?? body.priceRoute.contractAddress ?? null;

  if (!spenderAddress || spenderAddress.trim() === '') {
    throw new BusinessException('ParaSwap tokenTransferProxy is missing');
  }

  return {
    spenderAddress,
  };
}

export function ensurePositiveParaSwapAmount(value: string): void {
  let parsedValue: bigint;

  try {
    parsedValue = BigInt(value);
  } catch {
    throw new BusinessException('ParaSwap response contains invalid destAmount');
  }

  if (parsedValue <= ZERO_BIGINT) {
    throw new BusinessException('Недостаточно ликвидности для указанной пары');
  }
}

export function parseParaSwapGasUsd(value: string | undefined): number | null {
  if (value === undefined) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}
