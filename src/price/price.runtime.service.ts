import { Injectable } from '@nestjs/common';

import type { IPriceRequest, IPriceResponse } from './interfaces/price.interface';
import { PriceCache } from './price.cache';
import { PriceRepository } from './price.repository';
import { BusinessException } from '../common/exceptions/business.exception';
import { MetricsService } from '../metrics/metrics.service';

export interface ISuccessLogContext {
  request: IPriceRequest;
  response: IPriceResponse;
  fromToken: string;
  toToken: string;
  amount: string;
}

@Injectable()
export class PriceRuntimeService {
  public constructor(
    private readonly priceCache: PriceCache,
    private readonly priceRepository: PriceRepository,
    private readonly metricsService: MetricsService,
  ) {}

  public getCached(cacheKey: string): IPriceResponse | null {
    return this.priceCache.get(cacheKey);
  }

  public saveCached(cacheKey: string, response: IPriceResponse): void {
    this.priceCache.set(cacheKey, response);
  }

  public async logSuccess(context: ISuccessLogContext): Promise<void> {
    await this.priceRepository.logRequest({
      userId: context.request.userId,
      command: context.request.rawCommand,
      fromToken: context.fromToken,
      toToken: context.toToken,
      amount: context.amount,
      result: {
        chain: context.response.chain,
        aggregator: context.response.aggregator,
        fromAmount: context.response.fromAmount,
        toAmount: context.response.toAmount,
        estimatedGasUsd: context.response.estimatedGasUsd,
      },
      error: false,
      errorMessage: null,
    });

    this.metricsService.incrementPriceRequest('success');
  }

  public async logError(request: IPriceRequest, error: unknown): Promise<never> {
    const message = this.getErrorMessage(error);

    await this.priceRepository.logRequest({
      userId: request.userId,
      command: request.rawCommand,
      fromToken: request.fromSymbol.toUpperCase(),
      toToken: request.toSymbol.toUpperCase(),
      amount: request.amount,
      result: null,
      error: true,
      errorMessage: message,
    });

    this.metricsService.incrementPriceRequest('error');
    this.metricsService.incrementError('price_request_failed');
    throw new BusinessException(message);
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof BusinessException) {
      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown internal error';
  }
}
