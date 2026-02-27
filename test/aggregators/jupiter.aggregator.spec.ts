import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { JupiterAggregator } from '../../src/aggregators/jupiter/jupiter.aggregator';
import type { MetricsService } from '../../src/metrics/metrics.service';

const JUPITER_API_BASE_URL = 'https://lite-api.jup.ag';

function createAggregator(fetchMock: ReturnType<typeof vi.fn>): JupiterAggregator {
  const configValues: Record<string, string> = {
    JUPITER_API_BASE_URL,
  };
  const configService: Pick<ConfigService, 'get'> = {
    get: (key: string) => configValues[key],
  };
  const metricsService: Pick<MetricsService, 'observeExternalRequest'> = {
    observeExternalRequest: vi.fn(),
  };

  vi.stubGlobal('fetch', fetchMock);

  return new JupiterAggregator(configService as ConfigService, metricsService as MetricsService);
}

describe('JupiterAggregator', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('должен получать котировку для Solana через Jupiter quote API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        outAmount: '8141855',
      }),
    });
    const aggregator = createAggregator(fetchMock);

    const quote = await aggregator.getQuote({
      chain: 'solana',
      sellTokenAddress: 'So11111111111111111111111111111111111111112',
      buyTokenAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      sellAmountBaseUnits: '100000000',
      sellTokenDecimals: 9,
      buyTokenDecimals: 6,
    });

    expect(quote.aggregatorName).toBe('jupiter');
    expect(quote.toAmountBaseUnits).toBe('8141855');

    const requestedUrl = String(fetchMock.mock.calls[0]?.[0] ?? '');
    expect(requestedUrl).toContain('/swap/v1/quote');
    expect(requestedUrl).toContain('inputMint=So11111111111111111111111111111111111111112');
  });

  it('должен явно отклонять swap-транзакции для Solana до отдельной интеграции', async () => {
    const aggregator = createAggregator(vi.fn());

    await expect(
      aggregator.buildSwapTransaction({
        chain: 'solana',
        sellTokenAddress: 'So11111111111111111111111111111111111111112',
        buyTokenAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        sellAmountBaseUnits: '100000000',
        sellTokenDecimals: 9,
        buyTokenDecimals: 6,
        fromAddress: 'wallet',
        slippagePercentage: 0.5,
      }),
    ).rejects.toThrowError('Свапы в сети solana пока не поддерживаются');
  });
});
