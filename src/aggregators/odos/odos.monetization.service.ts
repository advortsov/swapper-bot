import { Injectable } from '@nestjs/common';

import {
  getOdosQuoteAmount,
  getValidatedOdosPartnerFeePercent,
  isOdosQuoteResponse,
  validateOdosFeeBreakdown,
} from './odos.quote-validator';
import { PERCENT_TO_BPS_MULTIPLIER, ZERO_FEE_BPS } from './odos.types';
import { BusinessException } from '../../common/exceptions/business.exception';
import type { MetricsService } from '../../metrics/metrics.service';
import type { IQuoteRequest, IQuoteResponse } from '../interfaces/aggregator.interface';

@Injectable()
export class OdosMonetizationService {
  public createDisabledQuoteResponse(
    aggregatorName: string,
    params: IQuoteRequest,
    responseBody: unknown,
  ): IQuoteResponse {
    if (!isOdosQuoteResponse(responseBody)) {
      throw new BusinessException('Odos quote response schema is invalid');
    }

    const quoteAmount = getOdosQuoteAmount(responseBody);

    return {
      aggregatorName,
      toAmountBaseUnits: quoteAmount,
      grossToAmountBaseUnits: quoteAmount,
      feeAmountBaseUnits: '0',
      feeAmountSymbol: null,
      feeAmountDecimals: null,
      feeBps: ZERO_FEE_BPS,
      feeMode: 'disabled',
      feeType: 'no fee',
      feeDisplayLabel: 'no fee',
      feeAppliedAtQuote: false,
      feeEnforcedOnExecution: false,
      feeAssetSide: 'none',
      executionFee: params.feeConfig,
      estimatedGasUsd: responseBody.gasEstimateValue ?? null,
      totalNetworkFeeWei: null,
      rawQuote: responseBody,
    };
  }

  public createMonetizedQuoteResponse(
    aggregatorName: string,
    metricsService: MetricsService,
    input: { params: IQuoteRequest; feeQuoteBody: unknown; shadowQuoteBody: unknown },
  ): IQuoteResponse {
    if (!isOdosQuoteResponse(input.feeQuoteBody)) {
      throw new BusinessException('Odos quote response schema is invalid');
    }

    if (!isOdosQuoteResponse(input.shadowQuoteBody)) {
      metricsService.incrementError('odos_referral_shadow_quote_failed');
      throw new BusinessException('Odos shadow quote response schema is invalid');
    }

    const netToAmountBaseUnits = getOdosQuoteAmount(input.feeQuoteBody);
    const grossToAmountBaseUnits = getOdosQuoteAmount(input.shadowQuoteBody);
    const partnerFeePercent = getValidatedOdosPartnerFeePercent(metricsService, input.feeQuoteBody);
    const feeAmountBaseUnits = (
      BigInt(grossToAmountBaseUnits) - BigInt(netToAmountBaseUnits)
    ).toString();

    validateOdosFeeBreakdown(
      metricsService,
      grossToAmountBaseUnits,
      netToAmountBaseUnits,
      feeAmountBaseUnits,
    );

    return {
      aggregatorName,
      toAmountBaseUnits: netToAmountBaseUnits,
      grossToAmountBaseUnits,
      feeAmountBaseUnits,
      feeAmountSymbol: null,
      feeAmountDecimals: null,
      feeBps: Math.round(partnerFeePercent * PERCENT_TO_BPS_MULTIPLIER),
      feeMode: 'enforced',
      feeType: 'partner fee',
      feeDisplayLabel: 'partner fee',
      feeAppliedAtQuote: true,
      feeEnforcedOnExecution: true,
      feeAssetSide: 'buy',
      executionFee: input.params.feeConfig,
      estimatedGasUsd: input.feeQuoteBody.gasEstimateValue ?? null,
      totalNetworkFeeWei: null,
      rawQuote: {
        feeQuote: input.feeQuoteBody,
        shadowQuote: input.shadowQuoteBody,
        referralCode:
          input.params.feeConfig.kind === 'odos' ? input.params.feeConfig.referralCode : null,
        partnerFeePercent,
      },
    };
  }
}
