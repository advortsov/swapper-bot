import { Injectable } from '@nestjs/common';

import type { IPriceRequest, IPriceResponse } from './interfaces/price.interface';
import { PriceQuoteService } from './price.quote.service';
import { PriceRuntimeService } from './price.runtime.service';
import { BusinessException } from '../common/exceptions/business.exception';

@Injectable()
export class PriceService {
  public constructor(
    private readonly quoteService: PriceQuoteService,
    private readonly runtimeService: PriceRuntimeService,
  ) {}

  public async getBestQuote(request: IPriceRequest): Promise<IPriceResponse> {
    try {
      const preparedInput = await this.quoteService.prepare(request);
      const cachedResponse = this.runtimeService.getCached(preparedInput.cacheKey);

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

      const bestQuote = await this.quoteService.fetchBestQuote(preparedInput);
      const response = this.quoteService.buildResponse(preparedInput, bestQuote);

      this.runtimeService.saveCached(preparedInput.cacheKey, response);
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
}
