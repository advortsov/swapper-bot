import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { resolveOdosApprovalTarget } from './odos.approval-target';
import { OdosExecutionBuilder } from './odos.execution-builder';
import { buildOdosQuotePayload } from './odos.quote-builder';
import { isOdosAssembleResponse, isOdosQuoteResponse } from './odos.quote-validator';
import { OdosResponseMapper } from './odos.response-mapper';
import type { IOdosQuotePayloadInput } from './odos.types';
import {
  ASSEMBLE_ENDPOINT_PATH,
  DEFAULT_QUOTE_USER_ADDRESS,
  DEFAULT_ODOS_API_BASE_URL,
  DEFAULT_SLIPPAGE_PERCENT,
  ODOS_SUPPORTED_CHAINS,
  QUOTE_ENDPOINT_PATH,
  REQUEST_TIMEOUT_MS,
} from './odos.types';
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
export class OdosAggregator extends BaseAggregator implements IAggregator {
  public readonly name: string = 'odos';
  public readonly supportedChains = ODOS_SUPPORTED_CHAINS;

  private readonly apiBaseUrl: string;
  private readonly apiKey: string;

  public constructor(
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
    private readonly responseMapper: OdosResponseMapper,
    private readonly executionBuilder: OdosExecutionBuilder,
  ) {
    super();
    this.apiBaseUrl =
      this.configService.get<string>('ODOS_API_BASE_URL') ?? DEFAULT_ODOS_API_BASE_URL;
    this.apiKey = this.configService.get<string>('ODOS_API_KEY') ?? '';
  }

  public async getQuote(params: IQuoteRequest): Promise<IQuoteResponse> {
    const payload = this.buildQuotePayload({
      chain: params.chain,
      sellTokenAddress: params.sellTokenAddress,
      buyTokenAddress: params.buyTokenAddress,
      sellAmountBaseUnits: params.sellAmountBaseUnits,
      userAddress: DEFAULT_QUOTE_USER_ADDRESS,
      slippageLimitPercent: DEFAULT_SLIPPAGE_PERCENT,
    });
    const startedAt = Date.now();

    try {
      if (params.feeConfig.kind !== 'odos' || params.feeConfig.mode !== 'enforced') {
        const response = await this.postJson(
          new URL(QUOTE_ENDPOINT_PATH, this.apiBaseUrl),
          payload,
        );
        this.observeRequest('POST', response.statusCode.toString(), startedAt);
        return this.responseMapper.toDisabledQuoteResponse(this.name, params, response.body);
      }

      const feeQuoteResponse = await this.postJson(new URL(QUOTE_ENDPOINT_PATH, this.apiBaseUrl), {
        ...payload,
        referralCode: params.feeConfig.referralCode,
      });
      const shadowQuoteResponse = await this.postJson(
        new URL(QUOTE_ENDPOINT_PATH, this.apiBaseUrl),
        payload,
      );
      this.observeRequest('POST', shadowQuoteResponse.statusCode.toString(), startedAt);

      return this.responseMapper.toMonetizedQuoteResponse(this.name, this.metricsService, {
        params,
        feeQuoteBody: feeQuoteResponse.body,
        shadowQuoteBody: shadowQuoteResponse.body,
      });
    } catch (error: unknown) {
      this.observeRequest('POST', '500', startedAt);
      throw error;
    }
  }

  public async buildSwapTransaction(params: ISwapRequest): Promise<ISwapTransaction> {
    const quotePayload = this.executionBuilder.buildQuotePayload(params);
    const startedAt = Date.now();

    try {
      const quoteResponse = await this.postJson(
        new URL(QUOTE_ENDPOINT_PATH, this.apiBaseUrl),
        quotePayload,
      );
      this.executionBuilder.validateExecutionQuote(
        this.metricsService,
        params.feeConfig,
        quoteResponse.body,
      );
      const assembleResponse = await this.postJson(
        new URL(ASSEMBLE_ENDPOINT_PATH, this.apiBaseUrl),
        this.executionBuilder.buildAssemblePayload(params.fromAddress, quoteResponse.body.pathId),
      );
      this.observeRequest('POST', assembleResponse.statusCode.toString(), startedAt);

      return this.executionBuilder.buildSwapTransaction(
        params.fromAddress,
        quoteResponse.body,
        assembleResponse.body,
      );
    } catch (error: unknown) {
      this.observeRequest('POST', '500', startedAt);
      throw error;
    }
  }

  public async resolveApprovalTarget(
    params: IApprovalTargetRequest,
  ): Promise<IApprovalTargetResponse> {
    return resolveOdosApprovalTarget({
      apiBaseUrl: this.apiBaseUrl,
      assembleEndpointPath: ASSEMBLE_ENDPOINT_PATH,
      buildQuotePayload: this.buildQuotePayload.bind(this),
      defaultSlippagePercent: DEFAULT_SLIPPAGE_PERCENT,
      observeRequest: this.observeRequest.bind(this),
      postJson: this.postJson.bind(this),
      quoteEndpointPath: QUOTE_ENDPOINT_PATH,
      request: params,
      validateAssembleResponse: isOdosAssembleResponse,
      validateQuoteResponse: isOdosQuoteResponse,
    });
  }

  public async healthCheck(): Promise<boolean> {
    const payload = this.executionBuilder.createHealthcheckQuotePayload();

    try {
      const response = await this.postJson(new URL(QUOTE_ENDPOINT_PATH, this.apiBaseUrl), payload);
      return isOdosQuoteResponse(response.body);
    } catch {
      return false;
    }
  }

  private buildQuotePayload(input: IOdosQuotePayloadInput): object {
    return buildOdosQuotePayload(input);
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };

    if (this.apiKey.trim() !== '') {
      headers['Authorization'] = this.apiKey;
    }

    return headers;
  }

  private async postJson(url: URL, body: object): Promise<{ statusCode: number; body: unknown }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const parsedBody = (await response.json()) as unknown;

      if (!response.ok) {
        throw new BusinessException(`Aggregator request failed with status ${response.status}`);
      }

      return { statusCode: response.status, body: parsedBody };
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

  private observeRequest(method: string, statusCode: string, startedAt: number): void {
    const durationSeconds = (Date.now() - startedAt) / 1_000;

    this.metricsService.observeExternalRequest({
      provider: this.name,
      method,
      statusCode,
      durationSeconds,
    });
  }
}
