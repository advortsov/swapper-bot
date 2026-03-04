import { ZERO_BIGINT, type IOdosAssembleResponse, type IOdosQuoteResponse } from './odos.types';
import { BusinessException } from '../../common/exceptions/business.exception';
import type { MetricsService } from '../../metrics/metrics.service';

export function isOdosQuoteResponse(value: unknown): value is IOdosQuoteResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const outAmounts = candidate['outAmounts'];

  return (
    typeof candidate['pathId'] === 'string' &&
    Array.isArray(outAmounts) &&
    outAmounts.every((item) => typeof item === 'string') &&
    (candidate['gasEstimateValue'] === undefined ||
      typeof candidate['gasEstimateValue'] === 'number')
  );
}

export function isOdosAssembleResponse(value: unknown): value is IOdosAssembleResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const transaction = candidate['transaction'];

  if (typeof transaction !== 'object' || transaction === null) {
    return false;
  }

  const tx = transaction as Record<string, unknown>;

  return (
    typeof tx['to'] === 'string' &&
    typeof tx['data'] === 'string' &&
    typeof tx['value'] === 'string'
  );
}

export function getOdosQuoteAmount(responseBody: { outAmounts: readonly string[] }): string {
  const quoteAmount = responseBody.outAmounts[0];

  if (quoteAmount === undefined || quoteAmount.trim() === '') {
    throw new BusinessException('Odos quote amount is missing');
  }

  return quoteAmount;
}

export function getValidatedOdosPartnerFeePercent(
  metricsService: MetricsService,
  responseBody: { partnerFeePercent?: number },
): number {
  if (responseBody.partnerFeePercent === undefined) {
    metricsService.incrementError('odos_referral_missing_partner_fee_percent');
    throw new BusinessException('Odos quote does not contain partnerFeePercent');
  }

  if (!Number.isFinite(responseBody.partnerFeePercent) || responseBody.partnerFeePercent <= 0) {
    metricsService.incrementError('odos_referral_zero_partner_fee');
    throw new BusinessException('Odos referral code is active but partner fee is zero');
  }

  return responseBody.partnerFeePercent;
}

export function validateOdosFeeBreakdown(
  metricsService: MetricsService,
  grossToAmountBaseUnits: string,
  netToAmountBaseUnits: string,
  feeAmountBaseUnits: string,
): void {
  if (BigInt(grossToAmountBaseUnits) < BigInt(netToAmountBaseUnits)) {
    metricsService.incrementError('odos_referral_negative_fee_breakdown');
    throw new BusinessException('Odos quote fee breakdown is inconsistent');
  }

  if (BigInt(feeAmountBaseUnits) <= ZERO_BIGINT) {
    metricsService.incrementError('odos_referral_negative_fee_breakdown');
    throw new BusinessException('Odos quote fee breakdown is inconsistent');
  }
}
