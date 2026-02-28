import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OdosAggregator } from '../../src/aggregators/odos/odos.aggregator';
import type { MetricsService } from '../../src/metrics/metrics.service';

const ODOS_API_BASE_URL = 'https://api.odos.xyz';
const ETH_PSEUDO_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

function createAggregator(fetchMock: ReturnType<typeof vi.fn>): OdosAggregator {
  const configValues: Record<string, string> = {
    ODOS_API_BASE_URL,
    ODOS_API_KEY: 'test-key',
  };
  const configService: Pick<ConfigService, 'get'> = {
    get: (key: string) => configValues[key],
  };
  const metricsService: Pick<MetricsService, 'observeExternalRequest'> = {
    observeExternalRequest: vi.fn(),
  };

  vi.stubGlobal('fetch', fetchMock);

  return new OdosAggregator(configService as ConfigService, metricsService as MetricsService);
}

describe('OdosAggregator', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('должен нормализовать ETH псевдо-адрес в нативный адрес Odos', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        outAmounts: ['1000000'],
        pathId: 'path-id',
        gasEstimateValue: 0.1,
      }),
    });
    const aggregator = createAggregator(fetchMock);

    await aggregator.getQuote({
      chain: 'ethereum',
      sellTokenAddress: ETH_PSEUDO_ADDRESS,
      buyTokenAddress: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      sellAmountBaseUnits: '1000000000000000',
      sellTokenDecimals: 18,
      buyTokenDecimals: 6,
    });

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(requestInit).toBeDefined();
    const body = JSON.parse((requestInit?.body as string | undefined) ?? '{}') as {
      inputTokens: { tokenAddress: string }[];
    };

    expect(body.inputTokens[0]?.tokenAddress).toBe('0x0000000000000000000000000000000000000000');
  });

  it('должен собирать своп-транзакцию через quote + assemble', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          outAmounts: ['1000000'],
          pathId: 'path-id',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          transaction: {
            to: '0x1111111111111111111111111111111111111111',
            data: '0xdeadbeef',
            value: '0',
          },
        }),
      });
    const aggregator = createAggregator(fetchMock);

    const transaction = await aggregator.buildSwapTransaction({
      chain: 'ethereum',
      sellTokenAddress: ETH_PSEUDO_ADDRESS,
      buyTokenAddress: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      sellAmountBaseUnits: '1000000000000000',
      sellTokenDecimals: 18,
      buyTokenDecimals: 6,
      fromAddress: '0x000000000000000000000000000000000000dEaD',
      slippagePercentage: 0.5,
    });

    expect(transaction).toEqual({
      kind: 'evm',
      to: '0x1111111111111111111111111111111111111111',
      data: '0xdeadbeef',
      value: '0',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
