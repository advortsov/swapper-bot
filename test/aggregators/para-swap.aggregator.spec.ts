import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ParaSwapAggregator } from '../../src/aggregators/para-swap/para-swap.aggregator';
import type { MetricsService } from '../../src/metrics/metrics.service';

const PARASWAP_API_BASE_URL = 'https://api.paraswap.io';

function createAggregator(fetchMock: ReturnType<typeof vi.fn>): ParaSwapAggregator {
  const configValues: Record<string, string> = {
    PARASWAP_API_BASE_URL,
    PARASWAP_API_VERSION: '6.2',
  };
  const configService: Pick<ConfigService, 'get'> = {
    get: (key: string) => configValues[key],
  };
  const metricsService: Pick<MetricsService, 'observeExternalRequest'> = {
    observeExternalRequest: vi.fn(),
  };

  vi.stubGlobal('fetch', fetchMock);

  return new ParaSwapAggregator(configService as ConfigService, metricsService as MetricsService);
}

describe('ParaSwapAggregator', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('должен добавлять partner fee params в quote запрос ParaSwap', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        priceRoute: {
          destAmount: '1000000',
          gasCostUSD: '0.1',
        },
      }),
    });
    const aggregator = createAggregator(fetchMock);

    await aggregator.getQuote({
      chain: 'ethereum',
      sellTokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      buyTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      sellAmountBaseUnits: '1000000000000000000',
      sellTokenDecimals: 18,
      buyTokenDecimals: 6,
      feeConfig: {
        kind: 'paraswap',
        aggregatorName: 'paraswap',
        chain: 'ethereum',
        mode: 'enforced',
        feeType: 'partner fee',
        feeBps: 15,
        feeAssetSide: 'buy',
        feeAssetAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        feeAssetSymbol: 'USDC',
        feeAppliedAtQuote: true,
        feeEnforcedOnExecution: true,
        partnerAddress: '0x1111111111111111111111111111111111111111',
        partnerName: 'swapper',
      },
    });

    const requestedUrl = String(fetchMock.mock.calls[0]?.[0] ?? '');
    expect(requestedUrl).toContain('version=6.2');
    expect(requestedUrl).toContain('partnerAddress=0x1111111111111111111111111111111111111111');
    expect(requestedUrl).toContain('partnerFeeBps=15');
    expect(requestedUrl).toContain('excludeContractMethodsWithoutFeeModel=true');
  });

  it('должен передавать partner fee params в transaction build', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          priceRoute: {
            destAmount: '1000000',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          to: '0x1111111111111111111111111111111111111111',
          data: '0xdeadbeef',
          value: '0',
        }),
      });
    const aggregator = createAggregator(fetchMock);

    await aggregator.buildSwapTransaction({
      chain: 'ethereum',
      sellTokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      buyTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      sellAmountBaseUnits: '1000000000000000000',
      sellTokenDecimals: 18,
      buyTokenDecimals: 6,
      fromAddress: '0x000000000000000000000000000000000000dEaD',
      slippagePercentage: 0.5,
      feeConfig: {
        kind: 'paraswap',
        aggregatorName: 'paraswap',
        chain: 'ethereum',
        mode: 'enforced',
        feeType: 'partner fee',
        feeBps: 15,
        feeAssetSide: 'buy',
        feeAssetAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        feeAssetSymbol: 'USDC',
        feeAppliedAtQuote: true,
        feeEnforcedOnExecution: true,
        partnerAddress: '0x1111111111111111111111111111111111111111',
        partnerName: 'swapper',
      },
    });

    const requestInit = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined;
    const requestBody = requestInit?.body;

    if (typeof requestBody !== 'string') {
      throw new Error('Expected ParaSwap transaction request body to be a string');
    }

    const transactionBody = JSON.parse(requestBody) as Record<string, unknown>;

    expect(transactionBody['partnerAddress']).toBe('0x1111111111111111111111111111111111111111');
    expect(transactionBody['partnerFeeBps']).toBe(15);
  });
});
