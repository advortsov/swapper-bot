import { Injectable } from '@nestjs/common';

import type { IPriceRequest, IPriceResponse } from './interfaces/price.interface';
import { PriceQuoteService } from './price.quote.service';
import { PriceRuntimeService } from './price.runtime.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { UserSettingsService } from '../settings/user-settings.service';

@Injectable()
export class PriceService {
  public constructor(
    private readonly quoteService: PriceQuoteService,
    private readonly runtimeService: PriceRuntimeService,
    private readonly userSettingsService: UserSettingsService,
  ) {}

  public async getBestQuote(request: IPriceRequest): Promise<IPriceResponse> {
    try {
      const preparedInput = await this.quoteService.prepare(request);
      const userSettings = await this.userSettingsService.getSettings(request.userId);
      const cacheKey = this.buildCacheKey(preparedInput.cacheKey, userSettings.preferredAggregator);
      const cachedResponse = this.runtimeService.getCached(cacheKey);

      if (cachedResponse) {
        await this.runtimeService.logSuccess({
          request,
          response: cachedResponse,
          fromToken: preparedInput.fromToken.symbol,
          toToken: preparedInput.toToken.symbol,
          amount: preparedInput.normalizedAmount,
        });

        return cachedResponse;
      }

      const quoteSelection = await this.quoteService.fetchQuoteSelection(
        preparedInput,
        userSettings.preferredAggregator,
      );
      const response = this.quoteService.buildResponse(preparedInput, quoteSelection);

      this.runtimeService.saveCached(cacheKey, response);
      await this.runtimeService.logSuccess({
        request,
        response,
        fromToken: preparedInput.fromToken.symbol,
        toToken: preparedInput.toToken.symbol,
        amount: preparedInput.normalizedAmount,
      });

      return response;
    } catch (error: unknown) {
      await this.runtimeService.logError(request, error);
      throw new BusinessException('Unexpected control flow after error logging');
    }
  }

  private buildCacheKey(baseCacheKey: string, preferredAggregator: string): string {
    if (preferredAggregator === 'auto') {
      return baseCacheKey;
    }

    return `${baseCacheKey}:${preferredAggregator}`;
  }
}
