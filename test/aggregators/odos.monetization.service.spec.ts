import { describe, expect, it, vi } from 'vitest';

import { OdosMonetizationService } from '../../src/aggregators/odos/odos.monetization.service';
import type { MetricsService } from '../../src/metrics/metrics.service';
import { createDisabledFeeConfig } from '../support/fee.fixtures';

const service = new OdosMonetizationService();
const metricsService: Pick<MetricsService, 'incrementError'> = { incrementError: vi.fn() };

describe('OdosMonetizationService', () => {
  it('должен собирать monetized quote response', () => {
    const result = service.createMonetizedQuoteResponse('odos', metricsService as MetricsService, {
      params: {
        chain: 'ethereum',
        sellTokenAddress: '0x1',
        buyTokenAddress: '0x2',
        sellAmountBaseUnits: '1',
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
          feeAssetAddress: '0x2',
          feeAssetSymbol: 'USDC',
          feeAppliedAtQuote: true,
          feeEnforcedOnExecution: true,
          referralCode: 1,
        },
      },
      feeQuoteBody: {
        outAmounts: ['998000'],
        pathId: 'fee',
        partnerFeePercent: 0.2,
        gasEstimateValue: 0.1,
      },
      shadowQuoteBody: { outAmounts: ['1000000'], pathId: 'shadow', gasEstimateValue: 0.1 },
    });

    expect(result.toAmountBaseUnits).toBe('998000');
    expect(result.grossToAmountBaseUnits).toBe('1000000');
    expect(result.feeAmountBaseUnits).toBe('2000');
    expect(result.feeBps).toBe(20);
  });

  it('должен собирать disabled quote response', () => {
    const result = service.createDisabledQuoteResponse(
      'odos',
      {
        chain: 'ethereum',
        sellTokenAddress: '0x1',
        buyTokenAddress: '0x2',
        sellAmountBaseUnits: '1',
        sellTokenDecimals: 18,
        buyTokenDecimals: 6,
        feeConfig: createDisabledFeeConfig('odos', 'ethereum'),
      },
      { outAmounts: ['1000000'], pathId: 'shadow', gasEstimateValue: 0.1 },
    );

    expect(result.toAmountBaseUnits).toBe('1000000');
    expect(result.feeAmountBaseUnits).toBe('0');
  });
});
