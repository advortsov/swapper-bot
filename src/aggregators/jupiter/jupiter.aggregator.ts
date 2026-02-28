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
const JUPITER_SWAP_PATH = '/swap/v1/swap';
const JUPITER_SUPPORTED_CHAINS = ['solana'] as const;
const DEFAULT_SLIPPAGE_BPS = '50';
const RESTRICT_INTERMEDIATE_TOKENS = 'true';
const HEALTHCHECK_INPUT_MINT = 'So11111111111111111111111111111111111111112';
const HEALTHCHECK_OUTPUT_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const HEALTHCHECK_AMOUNT = '100000000';
const BPS_PERCENT_MULTIPLIER = 100;

interface IJupiterQuoteResponse {
  outAmount: string;
}

interface IJupiterSwapResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
}

function isJupiterQuoteResponse(value: unknown): value is IJupiterQuoteResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate['outAmount'] === 'string';
}

function isJupiterSwapResponse(value: unknown): value is IJupiterSwapResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['swapTransaction'] === 'string' &&
    typeof candidate['lastValidBlockHeight'] === 'number'
  );
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

  public async buildSwapTransaction(params: ISwapRequest): Promise<ISwapTransaction> {
    const quoteUrl = this.buildQuoteUrl(
      params.sellTokenAddress,
      params.buyTokenAddress,
      params.sellAmountBaseUnits,
      this.toSlippageBps(params.slippagePercentage),
    );
    const startedAt = Date.now();

    try {
      const quoteResponse = await this.getJson(quoteUrl, this.buildHeaders());

      if (!isJupiterQuoteResponse(quoteResponse.body)) {
        throw new BusinessException('Jupiter response schema is invalid');
      }

      const swapResponse = await this.postJson(new URL(JUPITER_SWAP_PATH, this.apiBaseUrl), {
        quoteResponse: quoteResponse.body,
        userPublicKey: params.fromAddress,
        dynamicComputeUnitLimit: true,
        dynamicSlippage: true,
      });
      this.observeRequest(swapResponse.statusCode.toString(), startedAt, 'POST');

      if (!isJupiterSwapResponse(swapResponse.body)) {
        throw new BusinessException('Jupiter swap response schema is invalid');
      }

      return {
        kind: 'solana',
        to: '',
        data: '',
        value: '0',
        serializedTransaction: swapResponse.body.swapTransaction,
        lastValidBlockHeight: swapResponse.body.lastValidBlockHeight,
      };
    } catch (error: unknown) {
      this.observeRequest('500', startedAt, 'POST');
      throw error;
    }
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

  private buildQuoteUrl(
    inputMint: string,
    outputMint: string,
    amount: string,
    slippageBps: string = DEFAULT_SLIPPAGE_BPS,
  ): URL {
    const url = new URL(JUPITER_QUOTE_PATH, this.apiBaseUrl);
    url.searchParams.set('inputMint', inputMint);
    url.searchParams.set('outputMint', outputMint);
    url.searchParams.set('amount', amount);
    url.searchParams.set('slippageBps', slippageBps);
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

  private async postJson(url: URL, body: object): Promise<{ statusCode: number; body: unknown }> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...this.buildHeaders(),
      },
      body: JSON.stringify(body),
    });
    const parsedBody = (await response.json()) as unknown;

    if (!response.ok) {
      throw new BusinessException(`Aggregator request failed with status ${response.status}`);
    }

    return {
      statusCode: response.status,
      body: parsedBody,
    };
  }

  private toSlippageBps(slippagePercentage: number): string {
    return `${Math.max(Math.round(slippagePercentage * BPS_PERCENT_MULTIPLIER), 1)}`;
  }

  private observeRequest(
    statusCode: string,
    startedAt: number,
    method: 'GET' | 'POST' = 'GET',
  ): void {
    const durationSeconds = (Date.now() - startedAt) / 1_000;

    this.metricsService.observeExternalRequest({
      provider: this.name,
      method,
      statusCode,
      durationSeconds,
    });
  }
}
