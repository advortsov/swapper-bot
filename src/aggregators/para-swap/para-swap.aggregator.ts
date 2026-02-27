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

const DEFAULT_PARASWAP_API_BASE_URL = 'https://api.paraswap.io';
const PARASWAP_SUPPORTED_CHAINS = ['ethereum', 'arbitrum', 'base', 'optimism'] as const;
const NETWORK_BY_CHAIN: Readonly<Record<ChainType, string>> = {
  ethereum: '1',
  arbitrum: '42161',
  base: '8453',
  optimism: '10',
};
const SELL_SIDE = 'SELL';
const PARASWAP_NATIVE_TOKEN = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const USDC_TOKEN = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const USDC_DECIMALS = '6';
const WETH_DECIMALS = '18';
const HEALTHCHECK_SELL_AMOUNT = '1000000000000000';
const ZERO_BIGINT = 0n;
const REQUEST_TIMEOUT_MS = 10_000;

interface IParaSwapPriceRoute {
  destAmount: string;
  gasCostUSD?: string;
}

interface IParaSwapQuoteResponse {
  priceRoute: IParaSwapPriceRoute & Record<string, unknown>;
}

interface IParaSwapTransactionResponse {
  to: string;
  data: string;
  value: string;
}

function isParaSwapQuoteResponse(value: unknown): value is IParaSwapQuoteResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const priceRoute = record['priceRoute'];

  if (typeof priceRoute !== 'object' || priceRoute === null) {
    return false;
  }

  const routeRecord = priceRoute as Record<string, unknown>;
  const gasCostUSD = routeRecord['gasCostUSD'];

  return (
    typeof routeRecord['destAmount'] === 'string' &&
    (gasCostUSD === undefined || typeof gasCostUSD === 'string')
  );
}

function isParaSwapTransactionResponse(value: unknown): value is IParaSwapTransactionResponse {
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
export class ParaSwapAggregator extends BaseAggregator implements IAggregator {
  public readonly name: string = 'paraswap';
  public readonly supportedChains = PARASWAP_SUPPORTED_CHAINS;

  private readonly apiBaseUrl: string;

  public constructor(
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {
    super();
    this.apiBaseUrl =
      this.configService.get<string>('PARASWAP_API_BASE_URL') ?? DEFAULT_PARASWAP_API_BASE_URL;
  }

  public async getQuote(params: IQuoteRequest): Promise<IQuoteResponse> {
    const url = this.buildQuoteUrl(params);
    const startedAt = Date.now();

    try {
      const response = await this.getJson(url, {});
      this.observeRequest(response.statusCode.toString(), startedAt);

      if (!isParaSwapQuoteResponse(response.body)) {
        throw new BusinessException('ParaSwap response schema is invalid');
      }

      this.ensurePositiveAmount(response.body.priceRoute.destAmount);

      return {
        aggregatorName: this.name,
        toAmountBaseUnits: response.body.priceRoute.destAmount,
        estimatedGasUsd: this.parseGasUsd(response.body.priceRoute.gasCostUSD),
        totalNetworkFeeWei: null,
        rawQuote: response.body,
      };
    } catch (error: unknown) {
      this.observeRequest('500', startedAt);
      throw error;
    }
  }

  public async buildSwapTransaction(params: ISwapRequest): Promise<ISwapTransaction> {
    const priceUrl = this.buildQuoteUrl({
      chain: params.chain,
      sellTokenAddress: params.sellTokenAddress,
      buyTokenAddress: params.buyTokenAddress,
      sellAmountBaseUnits: params.sellAmountBaseUnits,
      sellTokenDecimals: params.sellTokenDecimals,
      buyTokenDecimals: params.buyTokenDecimals,
    });
    const startedAt = Date.now();

    try {
      const priceResponse = await this.getJson(priceUrl, {});

      if (!isParaSwapQuoteResponse(priceResponse.body)) {
        throw new BusinessException('ParaSwap response schema is invalid');
      }

      const transactionUrl = new URL('/transactions/1', this.apiBaseUrl);
      const network = NETWORK_BY_CHAIN[params.chain];
      transactionUrl.pathname = `/transactions/${network}`;
      transactionUrl.searchParams.set('ignoreChecks', 'true');

      const transactionResponse = await this.postJson(transactionUrl, {
        srcToken: this.normalizeToken(params.sellTokenAddress),
        destToken: this.normalizeToken(params.buyTokenAddress),
        srcAmount: params.sellAmountBaseUnits,
        srcDecimals: params.sellTokenDecimals,
        destDecimals: params.buyTokenDecimals,
        userAddress: params.fromAddress,
        slippage: params.slippagePercentage,
        priceRoute: priceResponse.body.priceRoute,
      });

      this.observeRequest(transactionResponse.statusCode.toString(), startedAt);

      if (!isParaSwapTransactionResponse(transactionResponse.body)) {
        throw new BusinessException('ParaSwap transaction response schema is invalid');
      }

      return {
        to: transactionResponse.body.to,
        data: transactionResponse.body.data,
        value: transactionResponse.body.value,
      };
    } catch (error: unknown) {
      this.observeRequest('500', startedAt);
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    const url = this.buildHealthcheckUrl();

    try {
      const response = await this.getJson(url, {});
      return isParaSwapQuoteResponse(response.body);
    } catch {
      return false;
    }
  }

  private buildQuoteUrl(params: IQuoteRequest): URL {
    const network = NETWORK_BY_CHAIN[params.chain];
    const url = new URL('/prices', this.apiBaseUrl);

    url.searchParams.set('srcToken', this.normalizeToken(params.sellTokenAddress));
    url.searchParams.set('destToken', this.normalizeToken(params.buyTokenAddress));
    url.searchParams.set('amount', params.sellAmountBaseUnits);
    url.searchParams.set('srcDecimals', `${params.sellTokenDecimals}`);
    url.searchParams.set('destDecimals', `${params.buyTokenDecimals}`);
    url.searchParams.set('side', SELL_SIDE);
    url.searchParams.set('network', network);

    return url;
  }

  private buildHealthcheckUrl(): URL {
    const url = new URL('/prices', this.apiBaseUrl);

    url.searchParams.set('srcToken', PARASWAP_NATIVE_TOKEN);
    url.searchParams.set('destToken', USDC_TOKEN);
    url.searchParams.set('amount', HEALTHCHECK_SELL_AMOUNT);
    url.searchParams.set('srcDecimals', WETH_DECIMALS);
    url.searchParams.set('destDecimals', USDC_DECIMALS);
    url.searchParams.set('side', SELL_SIDE);
    url.searchParams.set('network', NETWORK_BY_CHAIN.ethereum);

    return url;
  }

  private normalizeToken(tokenAddress: string): string {
    const normalized = tokenAddress.trim().toLowerCase();

    if (normalized === PARASWAP_NATIVE_TOKEN) {
      return PARASWAP_NATIVE_TOKEN;
    }

    return normalized;
  }

  private parseGasUsd(value: string | undefined): number | null {
    if (value === undefined) {
      return null;
    }

    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
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
        throw new BusinessException(`Aggregator request failed with status ${response.status}`);
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

  private ensurePositiveAmount(value: string): void {
    let parsedValue: bigint;

    try {
      parsedValue = BigInt(value);
    } catch {
      throw new BusinessException('ParaSwap response contains invalid destAmount');
    }

    if (parsedValue <= ZERO_BIGINT) {
      throw new BusinessException('Недостаточно ликвидности для указанной пары');
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
