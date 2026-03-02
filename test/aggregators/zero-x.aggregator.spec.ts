import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ZeroXAggregator } from '../../src/aggregators/zero-x/zero-x.aggregator';
import type { MetricsService } from '../../src/metrics/metrics.service';

const ZERO_X_API_BASE_URL = 'https://api.0x.org';

function createAggregator(fetchMock: ReturnType<typeof vi.fn>): ZeroXAggregator {
  const configValues: Record<string, string> = {
    ZERO_X_API_BASE_URL,
    ZERO_X_API_KEY: 'test-key',
  };
  const configService: Pick<ConfigService, 'get'> = {
    get: (key: string) => configValues[key],
  };
  const metricsService: Pick<MetricsService, 'observeExternalRequest'> = {
    observeExternalRequest: vi.fn(),
  };

  vi.stubGlobal('fetch', fetchMock);

  return new ZeroXAggregator(configService as ConfigService, metricsService as MetricsService);
}

describe('ZeroXAggregator', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('должен добавлять integrator fee params в quote запрос 0x', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        buyAmount: '1000000',
        liquidityAvailable: true,
        totalNetworkFee: null,
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
        kind: 'zerox',
        aggregatorName: '0x',
        chain: 'ethereum',
        mode: 'enforced',
        feeType: 'native fee',
        feeBps: 25,
        feeAssetSide: 'buy',
        feeAssetAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        feeAssetSymbol: 'USDC',
        feeAppliedAtQuote: true,
        feeEnforcedOnExecution: true,
        feeRecipient: '0x1111111111111111111111111111111111111111',
        feeTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      },
    });

    const requestedUrl = String(fetchMock.mock.calls[0]?.[0] ?? '');
    expect(requestedUrl).toContain('swapFeeRecipient=0x1111111111111111111111111111111111111111');
    expect(requestedUrl).toContain('swapFeeBps=25');
    expect(requestedUrl).toContain('swapFeeToken=0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48');
  });

  it('должен возвращать gross и fee из ответа 0x без потери provider breakdown', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        buyAmount: '990000',
        liquidityAvailable: true,
        totalNetworkFee: null,
        fees: {
          integratorFee: {
            amount: '10000',
          },
        },
      }),
    });
    const aggregator = createAggregator(fetchMock);

    const quote = await aggregator.getQuote({
      chain: 'ethereum',
      sellTokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      buyTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      sellAmountBaseUnits: '1000000000000000000',
      sellTokenDecimals: 18,
      buyTokenDecimals: 6,
      feeConfig: {
        kind: 'zerox',
        aggregatorName: '0x',
        chain: 'ethereum',
        mode: 'enforced',
        feeType: 'native fee',
        feeBps: 100,
        feeAssetSide: 'buy',
        feeAssetAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        feeAssetSymbol: 'USDC',
        feeAppliedAtQuote: true,
        feeEnforcedOnExecution: true,
        feeRecipient: '0x1111111111111111111111111111111111111111',
        feeTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      },
    });

    expect(quote.toAmountBaseUnits).toBe('990000');
    expect(quote.feeAmountBaseUnits).toBe('10000');
    expect(quote.grossToAmountBaseUnits).toBe('1000000');
  });
});
