import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { ChainType } from '../../chains/interfaces/chain.interface';
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
const BPS_PERCENT_MULTIPLIER = 100;
type IEvmChainType = Exclude<ChainType, 'solana'>;
const ZERO_X_SUPPORTED_CHAINS = ['ethereum', 'arbitrum', 'base', 'optimism'] as const;
const CHAIN_ID_BY_CHAIN: Readonly<Record<IEvmChainType, string>> = {
  ethereum: '1',
  arbitrum: '42161',
  base: '8453',
  optimism: '10',
};

interface IZeroXQuoteResponse {
  buyAmount: string;
  liquidityAvailable: boolean;
  totalNetworkFee: string | null;
  transaction?: IZeroXSwapTransaction;
}

interface IZeroXSwapTransaction {
  to: string;
  data: string;
  value: string;
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

function isZeroXSwapTransaction(value: unknown): value is IZeroXSwapTransaction {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record['to'] === 'string' &&
    typeof record['data'] === 'string' &&
    typeof record['value'] === 'string'
  );
}

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

  public async buildSwapTransaction(params: ISwapRequest): Promise<ISwapTransaction> {
    const url = this.buildSwapUrl(params);
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

      return {
        to: response.body.transaction.to,
        data: response.body.transaction.data,
        value: response.body.transaction.value,
      };
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

  private buildQuoteUrl(params: IQuoteRequest): URL {
    const url = new URL('/swap/allowance-holder/quote', this.apiBaseUrl);

    url.searchParams.set('chainId', this.resolveChainId(params.chain));
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

  private buildSwapUrl(params: ISwapRequest): URL {
    const url = new URL('/swap/allowance-holder/quote', this.apiBaseUrl);

    url.searchParams.set('chainId', this.resolveChainId(params.chain));
    url.searchParams.set('sellToken', params.sellTokenAddress);
    url.searchParams.set('buyToken', params.buyTokenAddress);
    url.searchParams.set('sellAmount', params.sellAmountBaseUnits);
    url.searchParams.set('taker', params.fromAddress);
    url.searchParams.set('slippageBps', this.toSlippageBps(params.slippagePercentage));

    return url;
  }

  private toSlippageBps(slippagePercentage: number): string {
    const slippageBps = Math.round(slippagePercentage * BPS_PERCENT_MULTIPLIER);
    return `${Math.max(slippageBps, 1)}`;
  }

  private resolveChainId(chain: ChainType): string {
    if (chain === 'solana') {
      throw new BusinessException('0x does not support Solana');
    }

    return CHAIN_ID_BY_CHAIN[chain];
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
