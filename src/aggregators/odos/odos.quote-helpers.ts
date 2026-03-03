import { BusinessException } from '../../common/exceptions/business.exception';
import type { MetricsService } from '../../metrics/metrics.service';

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
