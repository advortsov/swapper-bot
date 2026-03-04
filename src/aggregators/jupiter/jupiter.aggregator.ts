import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { resolveJupiterFeeAccount } from './jupiter.fee-account-resolver';
import { buildJupiterQuoteUrl, toJupiterSlippageBps } from './jupiter.quote-builder';
import {
  isJupiterQuoteResponse,
  isJupiterSwapResponse,
  toJupiterQuoteResponse,
} from './jupiter.response-mapper';
import {
  buildJupiterSwapRequest,
  buildJupiterSwapTransaction,
  buildJupiterSwapUrl,
} from './jupiter.swap-builder';
import {
  DEFAULT_JUPITER_API_BASE_URL,
  HEALTHCHECK_AMOUNT,
  HEALTHCHECK_INPUT_MINT,
  HEALTHCHECK_OUTPUT_MINT,
  JUPITER_SUPPORTED_CHAINS,
} from './jupiter.types';
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
    const url = buildJupiterQuoteUrl({
      apiBaseUrl: this.apiBaseUrl,
      inputMint: params.sellTokenAddress,
      outputMint: params.buyTokenAddress,
      amount: params.sellAmountBaseUnits,
      feeConfig: params.feeConfig,
    });
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

      return toJupiterQuoteResponse(this.name, params, response.body);
    } catch (error: unknown) {
      this.observeRequest('500', startedAt);
      throw error;
    }
  }

  public async buildSwapTransaction(params: ISwapRequest): Promise<ISwapTransaction> {
    const quoteUrl = buildJupiterQuoteUrl({
      apiBaseUrl: this.apiBaseUrl,
      inputMint: params.sellTokenAddress,
      outputMint: params.buyTokenAddress,
      amount: params.sellAmountBaseUnits,
      feeConfig: params.feeConfig,
      slippageBps: toJupiterSlippageBps(params.slippagePercentage),
    });
    const startedAt = Date.now();

    try {
      const quoteResponse = await this.getJson(quoteUrl, this.buildHeaders());

      if (!isJupiterQuoteResponse(quoteResponse.body)) {
        throw new BusinessException('Jupiter response schema is invalid');
      }

      const feeAccount = resolveJupiterFeeAccount(params.feeConfig);
      const swapResponse = await this.postJson(
        buildJupiterSwapUrl(this.apiBaseUrl),
        buildJupiterSwapRequest({
          quoteResponse: quoteResponse.body,
          userPublicKey: params.fromAddress,
          feeConfig: params.feeConfig,
          ...(feeAccount === undefined ? {} : { feeAccount }),
        }),
      );
      this.observeRequest(swapResponse.statusCode.toString(), startedAt, 'POST');

      if (!isJupiterSwapResponse(swapResponse.body)) {
        throw new BusinessException('Jupiter swap response schema is invalid');
      }

      return buildJupiterSwapTransaction(swapResponse.body);
    } catch (error: unknown) {
      this.observeRequest('500', startedAt, 'POST');
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    const url = buildJupiterQuoteUrl({
      apiBaseUrl: this.apiBaseUrl,
      inputMint: HEALTHCHECK_INPUT_MINT,
      outputMint: HEALTHCHECK_OUTPUT_MINT,
      amount: HEALTHCHECK_AMOUNT,
      feeConfig: {
        kind: 'none',
        aggregatorName: this.name,
        chain: 'solana',
        mode: 'disabled',
        feeType: 'no fee',
        feeBps: 0,
        feeAssetSide: 'none',
        feeAssetAddress: null,
        feeAssetSymbol: null,
        feeAppliedAtQuote: false,
        feeEnforcedOnExecution: false,
      },
    });

    try {
      const response = await this.getJson(url, this.buildHeaders());
      return isJupiterQuoteResponse(response.body);
    } catch {
      return false;
    }
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
