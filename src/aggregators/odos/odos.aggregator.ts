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

const DEFAULT_ODOS_API_BASE_URL = 'https://api.odos.xyz';
const QUOTE_ENDPOINT_PATH = '/sor/quote/v2';
const ASSEMBLE_ENDPOINT_PATH = '/sor/assemble';
type IEvmChainType = Exclude<ChainType, 'solana'>;
const ODOS_SUPPORTED_CHAINS = ['ethereum', 'arbitrum', 'base', 'optimism'] as const;
const CHAIN_ID_BY_CHAIN: Readonly<Record<IEvmChainType, number>> = {
  ethereum: 1,
  arbitrum: Number.parseInt('42161', 10),
  base: Number.parseInt('8453', 10),
  optimism: 10,
};
const ETH_PSEUDO_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const ODOS_NATIVE_ADDRESS = '0x0000000000000000000000000000000000000000';
const DEFAULT_QUOTE_USER_ADDRESS = '0x000000000000000000000000000000000000dead';
const HEALTHCHECK_SELL_TOKEN = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const HEALTHCHECK_BUY_TOKEN = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const HEALTHCHECK_SELL_AMOUNT = '10000000';
const REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_SLIPPAGE_PERCENT = 0.5;

interface IOdosQuoteToken {
  tokenAddress: string;
  amount: string;
}

interface IOdosQuoteRequest {
  chainId: number;
  inputTokens: readonly IOdosQuoteToken[];
  outputTokens: readonly { tokenAddress: string; proportion: number }[];
  slippageLimitPercent: number;
  userAddr: string;
  disableRFQs: boolean;
  compact: boolean;
}

interface IOdosQuoteResponse {
  outAmounts: readonly string[];
  pathId: string;
  gasEstimateValue?: number;
}

interface IOdosAssembleRequest {
  userAddr: string;
  pathId: string;
  simulate: boolean;
}

interface IOdosAssembleResponse {
  transaction: {
    to: string;
    data: string;
    value: string;
  };
}

function isOdosQuoteResponse(value: unknown): value is IOdosQuoteResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const outAmounts = candidate['outAmounts'];

  return (
    typeof candidate['pathId'] === 'string' &&
    Array.isArray(outAmounts) &&
    outAmounts.every((item) => typeof item === 'string') &&
    (candidate['gasEstimateValue'] === undefined ||
      typeof candidate['gasEstimateValue'] === 'number')
  );
}

function isOdosAssembleResponse(value: unknown): value is IOdosAssembleResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const transaction = candidate['transaction'];

  if (typeof transaction !== 'object' || transaction === null) {
    return false;
  }

  const tx = transaction as Record<string, unknown>;

  return (
    typeof tx['to'] === 'string' &&
    typeof tx['data'] === 'string' &&
    typeof tx['value'] === 'string'
  );
}

@Injectable()
export class OdosAggregator extends BaseAggregator implements IAggregator {
  public readonly name: string = 'odos';
  public readonly supportedChains = ODOS_SUPPORTED_CHAINS;

  private readonly apiBaseUrl: string;
  private readonly apiKey: string;

  public constructor(
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
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
      const response = await this.postJson(new URL(QUOTE_ENDPOINT_PATH, this.apiBaseUrl), payload);
      this.observeRequest('POST', response.statusCode.toString(), startedAt);

      if (!isOdosQuoteResponse(response.body)) {
        throw new BusinessException('Odos quote response schema is invalid');
      }

      const quoteAmount = response.body.outAmounts[0];

      if (quoteAmount === undefined || quoteAmount.trim() === '') {
        throw new BusinessException('Odos quote amount is missing');
      }

      return {
        aggregatorName: this.name,
        toAmountBaseUnits: quoteAmount,
        estimatedGasUsd: response.body.gasEstimateValue ?? null,
        totalNetworkFeeWei: null,
        rawQuote: response.body,
      };
    } catch (error: unknown) {
      this.observeRequest('POST', '500', startedAt);
      throw error;
    }
  }

  public async buildSwapTransaction(params: ISwapRequest): Promise<ISwapTransaction> {
    const quotePayload = this.buildQuotePayload({
      chain: params.chain,
      sellTokenAddress: params.sellTokenAddress,
      buyTokenAddress: params.buyTokenAddress,
      sellAmountBaseUnits: params.sellAmountBaseUnits,
      userAddress: params.fromAddress,
      slippageLimitPercent: params.slippagePercentage,
    });
    const startedAt = Date.now();

    try {
      const quoteResponse = await this.postJson(
        new URL(QUOTE_ENDPOINT_PATH, this.apiBaseUrl),
        quotePayload,
      );

      if (!isOdosQuoteResponse(quoteResponse.body)) {
        throw new BusinessException('Odos quote response schema is invalid');
      }

      if (quoteResponse.body.pathId.trim() === '') {
        throw new BusinessException('Odos pathId is missing');
      }

      const assemblePayload: IOdosAssembleRequest = {
        userAddr: params.fromAddress,
        pathId: quoteResponse.body.pathId,
        simulate: false,
      };

      const assembleResponse = await this.postJson(
        new URL(ASSEMBLE_ENDPOINT_PATH, this.apiBaseUrl),
        assemblePayload,
      );
      this.observeRequest('POST', assembleResponse.statusCode.toString(), startedAt);

      if (!isOdosAssembleResponse(assembleResponse.body)) {
        throw new BusinessException('Odos assemble response schema is invalid');
      }

      return {
        kind: 'evm',
        to: assembleResponse.body.transaction.to,
        data: assembleResponse.body.transaction.data,
        value: assembleResponse.body.transaction.value,
      };
    } catch (error: unknown) {
      this.observeRequest('POST', '500', startedAt);
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    const payload = this.buildQuotePayload({
      chain: 'ethereum',
      sellTokenAddress: HEALTHCHECK_SELL_TOKEN,
      buyTokenAddress: HEALTHCHECK_BUY_TOKEN,
      sellAmountBaseUnits: HEALTHCHECK_SELL_AMOUNT,
      userAddress: DEFAULT_QUOTE_USER_ADDRESS,
      slippageLimitPercent: DEFAULT_SLIPPAGE_PERCENT,
    });

    try {
      const response = await this.postJson(new URL(QUOTE_ENDPOINT_PATH, this.apiBaseUrl), payload);
      return isOdosQuoteResponse(response.body);
    } catch {
      return false;
    }
  }

  private buildQuotePayload(input: {
    chain: ChainType;
    sellTokenAddress: string;
    buyTokenAddress: string;
    sellAmountBaseUnits: string;
    userAddress: string;
    slippageLimitPercent: number;
  }): IOdosQuoteRequest {
    return {
      chainId: this.resolveChainId(input.chain),
      inputTokens: [
        {
          tokenAddress: this.normalizeTokenAddress(input.sellTokenAddress),
          amount: input.sellAmountBaseUnits,
        },
      ],
      outputTokens: [
        {
          tokenAddress: this.normalizeTokenAddress(input.buyTokenAddress),
          proportion: 1,
        },
      ],
      slippageLimitPercent: input.slippageLimitPercent,
      userAddr: input.userAddress,
      disableRFQs: true,
      compact: true,
    };
  }

  private normalizeTokenAddress(address: string): string {
    const normalized = address.trim();

    if (normalized.toLowerCase() === ETH_PSEUDO_ADDRESS) {
      return ODOS_NATIVE_ADDRESS;
    }

    return normalized;
  }

  private resolveChainId(chain: ChainType): number {
    if (chain === 'solana') {
      throw new BusinessException('Odos does not support Solana');
    }

    return CHAIN_ID_BY_CHAIN[chain];
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
