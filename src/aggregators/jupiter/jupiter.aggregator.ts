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

const DEFAULT_JUPITER_API_BASE_URL = 'https://lite-api.jup.ag';
const JUPITER_QUOTE_PATH = '/swap/v1/quote';
const JUPITER_SUPPORTED_CHAINS = ['solana'] as const;
const DEFAULT_SLIPPAGE_BPS = '50';
const RESTRICT_INTERMEDIATE_TOKENS = 'true';
const HEALTHCHECK_INPUT_MINT = 'So11111111111111111111111111111111111111112';
const HEALTHCHECK_OUTPUT_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const HEALTHCHECK_AMOUNT = '100000000';

interface IJupiterQuoteResponse {
  outAmount: string;
}

function isJupiterQuoteResponse(value: unknown): value is IJupiterQuoteResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate['outAmount'] === 'string';
}

@Injectable()
export class JupiterAggregator extends BaseAggregator implements IAggregator {
  public readonly name: string = 'jupiter';
  public readonly supportedChains = JUPITER_SUPPORTED_CHAINS;

  private readonly apiBaseUrl: string;
  private readonly apiKey: string;

  public constructor(
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {
    super();
    this.apiBaseUrl =
      this.configService.get<string>('JUPITER_API_BASE_URL') ??
      this.configService.get<string>('JUPITER_BASE_URL') ??
      DEFAULT_JUPITER_API_BASE_URL;
    this.apiKey = this.configService.get<string>('JUPITER_API_KEY') ?? '';
  }

  public async getQuote(params: IQuoteRequest): Promise<IQuoteResponse> {
    const url = this.buildQuoteUrl(
      params.sellTokenAddress,
      params.buyTokenAddress,
      params.sellAmountBaseUnits,
    );
    const startedAt = Date.now();

    try {
      const response = await this.getJson(url, this.buildHeaders());
      this.observeRequest(response.statusCode.toString(), startedAt);

      if (!isJupiterQuoteResponse(response.body)) {
        throw new BusinessException('Jupiter response schema is invalid');
      }

      if (response.body.outAmount.trim() === '') {
        throw new BusinessException('Jupiter quote amount is missing');
      }

      return {
        aggregatorName: this.name,
        toAmountBaseUnits: response.body.outAmount,
        estimatedGasUsd: null,
        totalNetworkFeeWei: null,
        rawQuote: response.body,
      };
    } catch (error: unknown) {
      this.observeRequest('500', startedAt);
      throw error;
    }
  }

  public async buildSwapTransaction(_params: ISwapRequest): Promise<ISwapTransaction> {
    throw new BusinessException('Свапы в сети solana пока не поддерживаются');
  }

  public async healthCheck(): Promise<boolean> {
    const url = this.buildQuoteUrl(
      HEALTHCHECK_INPUT_MINT,
      HEALTHCHECK_OUTPUT_MINT,
      HEALTHCHECK_AMOUNT,
    );

    try {
      const response = await this.getJson(url, this.buildHeaders());
      return isJupiterQuoteResponse(response.body);
    } catch {
      return false;
    }
  }

  private buildQuoteUrl(inputMint: string, outputMint: string, amount: string): URL {
    const url = new URL(JUPITER_QUOTE_PATH, this.apiBaseUrl);
    url.searchParams.set('inputMint', inputMint);
    url.searchParams.set('outputMint', outputMint);
    url.searchParams.set('amount', amount);
    url.searchParams.set('slippageBps', DEFAULT_SLIPPAGE_BPS);
    url.searchParams.set('restrictIntermediateTokens', RESTRICT_INTERMEDIATE_TOKENS);
    return url;
  }

  private buildHeaders(): Record<string, string> {
    if (this.apiKey.trim() === '') {
      return {};
    }

    return {
      'x-api-key': this.apiKey,
    };
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
