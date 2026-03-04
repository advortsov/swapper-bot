import { Injectable } from '@nestjs/common';

import { OdosMonetizationService } from './odos.monetization.service';
import type { MetricsService } from '../../metrics/metrics.service';
import type { IQuoteRequest, IQuoteResponse } from '../interfaces/aggregator.interface';

@Injectable()
export class OdosResponseMapper {
  public constructor(private readonly monetizationService: OdosMonetizationService) {}

  public toDisabledQuoteResponse(
    aggregatorName: string,
    params: IQuoteRequest,
    responseBody: unknown,
  ): IQuoteResponse {
    return this.monetizationService.createDisabledQuoteResponse(
      aggregatorName,
      params,
      responseBody,
    );
  }

  public toMonetizedQuoteResponse(
    aggregatorName: string,
    metricsService: MetricsService,
    input: { params: IQuoteRequest; feeQuoteBody: unknown; shadowQuoteBody: unknown },
  ): IQuoteResponse {
    return this.monetizationService.createMonetizedQuoteResponse(
      aggregatorName,
      metricsService,
      input,
    );
  }
}
