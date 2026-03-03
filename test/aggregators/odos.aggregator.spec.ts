import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OdosAggregator } from '../../src/aggregators/odos/odos.aggregator';
import type { MetricsService } from '../../src/metrics/metrics.service';
import { createDisabledFeeConfig } from '../support/fee.fixtures';

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
  const metricsService: Pick<MetricsService, 'observeExternalRequest' | 'incrementError'> = {
    observeExternalRequest: vi.fn(),
    incrementError: vi.fn(),
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
      feeConfig: createDisabledFeeConfig('odos', 'ethereum'),
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
      feeConfig: createDisabledFeeConfig('odos', 'ethereum'),
    });

    expect(transaction).toEqual({
      kind: 'evm',
      to: '0x1111111111111111111111111111111111111111',
      data: '0xdeadbeef',
      value: '0',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('должен добавлять referralCode и строить fee-aware quote через double quote', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          outAmounts: ['998000'],
          pathId: 'fee-path-id',
          partnerFeePercent: 0.2,
          gasEstimateValue: 0.1,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          outAmounts: ['1000000'],
          pathId: 'shadow-path-id',
          gasEstimateValue: 0.1,
        }),
      });
    const aggregator = createAggregator(fetchMock);

    const quote = await aggregator.getQuote({
      chain: 'ethereum',
      sellTokenAddress: ETH_PSEUDO_ADDRESS,
      buyTokenAddress: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      sellAmountBaseUnits: '1000000000000000',
      sellTokenDecimals: 18,
      buyTokenDecimals: 6,
      feeConfig: {
        kind: 'odos',
        aggregatorName: 'odos',
        chain: 'ethereum',
        mode: 'enforced',
        feeType: 'partner fee',
        feeBps: 0,
        feeAssetSide: 'buy',
        feeAssetAddress: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        feeAssetSymbol: 'USDC',
        feeAppliedAtQuote: true,
        feeEnforcedOnExecution: true,
        referralCode: 2147483648,
      },
    });

    const feeAwareRequest = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const shadowRequest = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined;
    const feeAwareBody = JSON.parse((feeAwareRequest?.body as string | undefined) ?? '{}') as {
      referralCode?: number;
    };
    const shadowBody = JSON.parse((shadowRequest?.body as string | undefined) ?? '{}') as {
      referralCode?: number;
    };

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(feeAwareBody.referralCode).toBe(2147483648);
    expect(shadowBody.referralCode).toBeUndefined();
    expect(quote.grossToAmountBaseUnits).toBe('1000000');
    expect(quote.feeAmountBaseUnits).toBe('2000');
    expect(quote.toAmountBaseUnits).toBe('998000');
    expect(quote.feeBps).toBe(20);
    expect(quote.feeType).toBe('partner fee');
  });

  it('должен падать при нулевом partner fee в enforced режиме', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          outAmounts: ['998000'],
          pathId: 'fee-path-id',
          partnerFeePercent: 0,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          outAmounts: ['1000000'],
          pathId: 'shadow-path-id',
        }),
      });
    const aggregator = createAggregator(fetchMock);

    await expect(
      aggregator.getQuote({
        chain: 'ethereum',
        sellTokenAddress: ETH_PSEUDO_ADDRESS,
        buyTokenAddress: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        sellAmountBaseUnits: '1000000000000000',
        sellTokenDecimals: 18,
        buyTokenDecimals: 6,
        feeConfig: {
          kind: 'odos',
          aggregatorName: 'odos',
          chain: 'ethereum',
          mode: 'enforced',
          feeType: 'partner fee',
          feeBps: 0,
          feeAssetSide: 'buy',
          feeAssetAddress: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          feeAssetSymbol: 'USDC',
          feeAppliedAtQuote: true,
          feeEnforcedOnExecution: true,
          referralCode: 2147483648,
        },
      }),
    ).rejects.toThrowError('Odos referral code is active but partner fee is zero');
  });

  it('должен передавать referralCode только в execution quote, но не в assemble', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          outAmounts: ['1000000'],
          pathId: 'path-id',
          partnerFeePercent: 0.2,
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

    await aggregator.buildSwapTransaction({
      chain: 'ethereum',
      sellTokenAddress: ETH_PSEUDO_ADDRESS,
      buyTokenAddress: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      sellAmountBaseUnits: '1000000000000000',
      sellTokenDecimals: 18,
      buyTokenDecimals: 6,
      fromAddress: '0x000000000000000000000000000000000000dEaD',
      slippagePercentage: 0.5,
      feeConfig: {
        kind: 'odos',
        aggregatorName: 'odos',
        chain: 'ethereum',
        mode: 'enforced',
        feeType: 'partner fee',
        feeBps: 0,
        feeAssetSide: 'buy',
        feeAssetAddress: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        feeAssetSymbol: 'USDC',
        feeAppliedAtQuote: true,
        feeEnforcedOnExecution: true,
        referralCode: 2147483648,
      },
    });

    const quoteRequest = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const assembleRequest = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined;
    const quoteBody = JSON.parse((quoteRequest?.body as string | undefined) ?? '{}') as {
      referralCode?: number;
    };
    const assembleBody = JSON.parse((assembleRequest?.body as string | undefined) ?? '{}') as {
      referralCode?: number;
    };

    expect(quoteBody.referralCode).toBe(2147483648);
    expect(assembleBody.referralCode).toBeUndefined();
  });
});
