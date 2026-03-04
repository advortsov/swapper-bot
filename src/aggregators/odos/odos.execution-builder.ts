import { Injectable } from '@nestjs/common';

import { buildOdosAssemblePayload, buildOdosQuotePayload } from './odos.quote-builder';
import {
  getValidatedOdosPartnerFeePercent,
  isOdosAssembleResponse,
  isOdosQuoteResponse,
} from './odos.quote-validator';
import {
  DEFAULT_QUOTE_USER_ADDRESS,
  DEFAULT_SLIPPAGE_PERCENT,
  HEALTHCHECK_BUY_TOKEN,
  HEALTHCHECK_SELL_AMOUNT,
  HEALTHCHECK_SELL_TOKEN,
  type IOdosQuoteResponse,
} from './odos.types';
import { BusinessException } from '../../common/exceptions/business.exception';
import type { MetricsService } from '../../metrics/metrics.service';
import type { ISwapRequest, ISwapTransaction } from '../interfaces/aggregator.interface';

@Injectable()
export class OdosExecutionBuilder {
  public buildQuotePayload(params: ISwapRequest): object {
    return buildOdosQuotePayload({
      chain: params.chain,
      sellTokenAddress: params.sellTokenAddress,
      buyTokenAddress: params.buyTokenAddress,
      sellAmountBaseUnits: params.sellAmountBaseUnits,
      userAddress: params.fromAddress,
      slippageLimitPercent: params.slippagePercentage,
      ...(params.feeConfig.kind === 'odos' && params.feeConfig.mode === 'enforced'
        ? { referralCode: params.feeConfig.referralCode }
        : {}),
    });
  }

  public createHealthcheckQuotePayload(): object {
    return buildOdosQuotePayload({
      chain: 'ethereum',
      sellTokenAddress: HEALTHCHECK_SELL_TOKEN,
      buyTokenAddress: HEALTHCHECK_BUY_TOKEN,
      sellAmountBaseUnits: HEALTHCHECK_SELL_AMOUNT,
      userAddress: DEFAULT_QUOTE_USER_ADDRESS,
      slippageLimitPercent: DEFAULT_SLIPPAGE_PERCENT,
    });
  }

  public validateExecutionQuote(
    metricsService: MetricsService,
    feeConfig: ISwapRequest['feeConfig'],
    body: unknown,
  ): asserts body is IOdosQuoteResponse {
    if (!isOdosQuoteResponse(body)) {
      throw new BusinessException('Odos quote response schema is invalid');
    }

    if (feeConfig.kind === 'odos' && feeConfig.mode === 'enforced') {
      getValidatedOdosPartnerFeePercent(metricsService, body);
    }

    if (body.pathId.trim() === '') {
      throw new BusinessException('Odos pathId is missing');
    }
  }

  public buildSwapTransaction(
    fromAddress: string,
    quoteBody: IOdosQuoteResponse,
    assembleBody: unknown,
  ): ISwapTransaction {
    if (!isOdosAssembleResponse(assembleBody)) {
      throw new BusinessException('Odos assemble response schema is invalid');
    }
    void fromAddress;
    void quoteBody;

    return {
      kind: 'evm',
      to: assembleBody.transaction.to,
      data: assembleBody.transaction.data,
      value: assembleBody.transaction.value,
    };
  }

  public buildAssemblePayload(fromAddress: string, pathId: string): object {
    return buildOdosAssemblePayload(fromAddress, pathId);
  }
}
