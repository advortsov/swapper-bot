import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { buildZeroXQuoteUrl, buildZeroXSwapUrl } from './zero-x.quote-builder';
import {
  extractZeroXApprovalTarget,
  isZeroXQuoteResponse,
  isZeroXSwapTransaction,
  toZeroXQuoteResponse,
} from './zero-x.response-mapper';
import { buildZeroXSwapTransaction } from './zero-x.transaction-builder';
import {
  DEFAULT_TAKER_ADDRESS,
  DEFAULT_ZERO_X_API_BASE_URL,
  ZERO_X_SUPPORTED_CHAINS,
  ZERO_X_VERSION,
} from './zero-x.types';
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
export class ZeroXAggregator extends BaseAggregator implements IAggregator {
  public readonly name: string = '0x';
  public readonly supportedChains = ZERO_X_SUPPORTED_CHAINS;

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
    const url = buildZeroXQuoteUrl(this.apiBaseUrl, this.takerAddress, params);
    const headers = this.buildHeaders();
    const startedAt = Date.now();

    try {
      const response = await this.getJson(url, headers);
      this.observeRequest('200', startedAt);

      if (!isZeroXQuoteResponse(response.body)) {
        throw new BusinessException('0x response schema is invalid');
      }

      return toZeroXQuoteResponse(this.name, params, response.body);
    } catch (error: unknown) {
      this.observeRequest('500', startedAt);
      throw error;
    }
  }

  public async buildSwapTransaction(params: ISwapRequest): Promise<ISwapTransaction> {
    const url = buildZeroXSwapUrl(this.apiBaseUrl, params);
    const headers = this.buildHeaders();
    const startedAt = Date.now();

    try {
      const response = await this.getJson(url, headers);
      this.observeRequest(response.statusCode.toString(), startedAt);

      if (!isZeroXQuoteResponse(response.body)) {
        throw new BusinessException('0x response schema is invalid');
      }

      if (!response.body.transaction || !isZeroXSwapTransaction(response.body.transaction)) {
        throw new BusinessException('0x swap transaction is missing in response');
      }

      return buildZeroXSwapTransaction(response.body.transaction);
    } catch (error: unknown) {
      this.observeRequest('500', startedAt);
      throw error;
    }
  }

  public async resolveApprovalTarget(
    params: IApprovalTargetRequest,
  ): Promise<IApprovalTargetResponse> {
    const url = buildZeroXQuoteUrl(this.apiBaseUrl, this.takerAddress, {
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
    url.searchParams.set('taker', params.userAddress);
    const startedAt = Date.now();

    try {
      const response = await this.getJson(url, this.buildHeaders());
      this.observeRequest(response.statusCode.toString(), startedAt);

      if (!isZeroXQuoteResponse(response.body)) {
        throw new BusinessException('0x response schema is invalid');
      }

      return extractZeroXApprovalTarget(response.body);
    } catch (error: unknown) {
      this.observeRequest('500', startedAt);
      throw error;
    }
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
