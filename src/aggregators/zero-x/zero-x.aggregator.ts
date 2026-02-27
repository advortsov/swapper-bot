import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BusinessException } from '../../common/exceptions/business.exception';
import { MetricsService } from '../../metrics/metrics.service';
import { BaseAggregator } from '../base/base.aggregator';
import type {
  IAggregator,
  IQuoteRequest,
  IQuoteResponse,
  ISwapRequest,
  ISwapTransaction,
} from '../interfaces/aggregator.interface';

const ZERO_X_VERSION = 'v2';
const DEFAULT_ZERO_X_API_BASE_URL = 'https://api.0x.org';
const DEFAULT_TAKER_ADDRESS = '0x0000000000000000000000000000000000010000';

interface IZeroXQuoteResponse {
  buyAmount: string;
  liquidityAvailable: boolean;
  totalNetworkFee: string | null;
}

function isZeroXQuoteResponse(value: unknown): value is IZeroXQuoteResponse {
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

@Injectable()
export class ZeroXAggregator extends BaseAggregator implements IAggregator {
  public readonly name: string = '0x';
  public readonly supportedChains = ['ethereum'] as const;

  private readonly apiKey: string;
  private readonly apiBaseUrl: string;
  private readonly takerAddress: string;

  public constructor(
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {
    super();

    this.apiKey =
      this.configService.get<string>('ZERO_X_API_KEY') ??
      this.configService.get<string>('ZEROEX_API_KEY') ??
      '';
    this.apiBaseUrl =
      this.configService.get<string>('ZERO_X_API_BASE_URL') ?? DEFAULT_ZERO_X_API_BASE_URL;
    this.takerAddress =
      this.configService.get<string>('ZERO_X_TAKER_ADDRESS') ?? DEFAULT_TAKER_ADDRESS;
  }

  public async getQuote(params: IQuoteRequest): Promise<IQuoteResponse> {
    const url = this.buildQuoteUrl(params);
    const headers = this.buildHeaders();
    const startedAt = Date.now();

    try {
      const response = await this.getJson(url, headers);
      this.observeRequest('200', startedAt);

      if (!isZeroXQuoteResponse(response.body)) {
        throw new BusinessException('0x response schema is invalid');
      }

      if (!response.body.liquidityAvailable) {
        throw new BusinessException('Недостаточно ликвидности для указанной пары');
      }

      return {
        aggregatorName: this.name,
        toAmountBaseUnits: response.body.buyAmount,
        estimatedGasUsd: null,
        totalNetworkFeeWei: response.body.totalNetworkFee,
        rawQuote: response.body,
      };
    } catch (error: unknown) {
      this.observeRequest('500', startedAt);
      throw error;
    }
  }

  public async buildSwapTransaction(_params: ISwapRequest): Promise<ISwapTransaction> {
    throw new BusinessException('Swap transaction build is not available on phase 1');
  }

  public async healthCheck(): Promise<boolean> {
    const url = new URL('/healthz', this.apiBaseUrl);

    try {
      await this.getJson(url, this.buildHeaders());
      return true;
    } catch {
      return false;
    }
  }

  private buildQuoteUrl(params: IQuoteRequest): URL {
    const url = new URL('/swap/allowance-holder/quote', this.apiBaseUrl);

    url.searchParams.set('chainId', '1');
    url.searchParams.set('sellToken', params.sellTokenAddress);
    url.searchParams.set('buyToken', params.buyTokenAddress);
    url.searchParams.set('sellAmount', params.sellAmountBaseUnits);
    url.searchParams.set('taker', this.takerAddress);

    return url;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      '0x-version': ZERO_X_VERSION,
    };

    if (this.apiKey.trim() !== '') {
      headers['0x-api-key'] = this.apiKey;
    }

    return headers;
  }

  private observeRequest(statusCode: string, startedAt: number): void {
    const durationSeconds = (Date.now() - startedAt) / 1_000;

    this.metricsService.observeExternalRequest({
      provider: this.name,
      method: 'GET',
      statusCode,
      durationSeconds,
    });
  }
}
