import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { buildParaSwapQuoteUrl, buildParaSwapHealthcheckUrl } from './para-swap.quote-builder';
import {
  extractParaSwapApprovalTarget,
  isParaSwapQuoteResponse,
  isParaSwapTransactionResponse,
  toParaSwapQuoteResponse,
} from './para-swap.response-mapper';
import {
  buildParaSwapTransactionBody,
  buildParaSwapTransactionUrl,
} from './para-swap.transaction-builder';
import {
  DEFAULT_PARASWAP_API_BASE_URL,
  DEFAULT_PARASWAP_API_VERSION,
  ERROR_BODY_MAX_LENGTH,
  PARASWAP_SUPPORTED_CHAINS,
  REQUEST_TIMEOUT_MS,
} from './para-swap.types';
import type {
  IApprovalTargetRequest,
  IApprovalTargetResponse,
} from '../../allowance/interfaces/allowance.interface';
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
export class ParaSwapAggregator extends BaseAggregator implements IAggregator {
  public readonly name: string = 'paraswap';
  public readonly supportedChains = PARASWAP_SUPPORTED_CHAINS;

  private readonly apiBaseUrl: string;
  private readonly apiVersion: string;

  public constructor(
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {
    super();
    this.apiBaseUrl =
      this.configService.get<string>('PARASWAP_API_BASE_URL') ?? DEFAULT_PARASWAP_API_BASE_URL;
    this.apiVersion =
      this.configService.get<string>('PARASWAP_API_VERSION') ?? DEFAULT_PARASWAP_API_VERSION;
  }

  public async getQuote(params: IQuoteRequest): Promise<IQuoteResponse> {
    const url = buildParaSwapQuoteUrl(this.apiBaseUrl, this.apiVersion, params);
    const startedAt = Date.now();

    try {
      const response = await this.getJson(url, {});
      this.observeRequest(response.statusCode.toString(), startedAt);

      if (!isParaSwapQuoteResponse(response.body)) {
        throw new BusinessException('ParaSwap response schema is invalid');
      }

      return toParaSwapQuoteResponse(this.name, params, response.body);
    } catch (error: unknown) {
      this.observeRequest('500', startedAt);
      throw error;
    }
  }

  public async buildSwapTransaction(params: ISwapRequest): Promise<ISwapTransaction> {
    const priceUrl = buildParaSwapQuoteUrl(this.apiBaseUrl, this.apiVersion, {
      chain: params.chain,
      sellTokenAddress: params.sellTokenAddress,
      buyTokenAddress: params.buyTokenAddress,
      sellAmountBaseUnits: params.sellAmountBaseUnits,
      sellTokenDecimals: params.sellTokenDecimals,
      buyTokenDecimals: params.buyTokenDecimals,
      feeConfig: params.feeConfig,
    });
    const startedAt = Date.now();

    try {
      const priceResponse = await this.getJson(priceUrl, {});

      if (!isParaSwapQuoteResponse(priceResponse.body)) {
        throw new BusinessException('ParaSwap response schema is invalid');
      }

      const transactionResponse = await this.postJson(
        buildParaSwapTransactionUrl(this.apiBaseUrl, params.chain),
        buildParaSwapTransactionBody(params, priceResponse.body.priceRoute),
      );

      this.observeRequest(transactionResponse.statusCode.toString(), startedAt);

      if (!isParaSwapTransactionResponse(transactionResponse.body)) {
        throw new BusinessException('ParaSwap transaction response schema is invalid');
      }

      return {
        kind: 'evm',
        to: transactionResponse.body.to,
        data: transactionResponse.body.data,
        value: transactionResponse.body.value,
      };
    } catch (error: unknown) {
      this.observeRequest('500', startedAt);
      throw error;
    }
  }

  public async resolveApprovalTarget(
    params: IApprovalTargetRequest,
  ): Promise<IApprovalTargetResponse> {
    const url = buildParaSwapQuoteUrl(this.apiBaseUrl, this.apiVersion, {
      chain: params.chain,
      sellTokenAddress: params.sellTokenAddress,
      buyTokenAddress: params.buyTokenAddress,
      sellAmountBaseUnits: params.sellAmountBaseUnits,
      sellTokenDecimals: 18,
      buyTokenDecimals: 6,
      feeConfig: {
        kind: 'none',
        aggregatorName: this.name,
        chain: params.chain,
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
    const startedAt = Date.now();

    try {
      const response = await this.getJson(url, {});
      this.observeRequest(response.statusCode.toString(), startedAt);

      if (!isParaSwapQuoteResponse(response.body)) {
        throw new BusinessException('ParaSwap response schema is invalid');
      }

      return extractParaSwapApprovalTarget(response.body);
    } catch (error: unknown) {
      this.observeRequest('500', startedAt);
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    const url = buildParaSwapHealthcheckUrl(this.apiBaseUrl, this.apiVersion);

    try {
      const response = await this.getJson(url, {});
      return isParaSwapQuoteResponse(response.body);
    } catch {
      return false;
    }
  }

  private async postJson(
    url: URL,
    body: Record<string, unknown>,
  ): Promise<{ statusCode: number; body: unknown }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const parsedBody = (await response.json()) as unknown;

      if (!response.ok) {
        const errorDetail =
          typeof parsedBody === 'object' && parsedBody !== null
            ? JSON.stringify(parsedBody).slice(0, ERROR_BODY_MAX_LENGTH)
            : '';
        throw new BusinessException(
          `Aggregator request failed with status ${response.status}${
            errorDetail ? `: ${errorDetail}` : ''
          }`,
        );
      }

      return {
        statusCode: response.status,
        body: parsedBody,
      };
    } catch (error: unknown) {
      if (error instanceof BusinessException) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new BusinessException('Aggregator request timed out');
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new BusinessException(`Aggregator request failed: ${message}`);
    } finally {
      clearTimeout(timeout);
    }
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
