import { describe, expect, it } from 'vitest';

import { toZeroXQuoteResponse } from '../../src/aggregators/zero-x/zero-x.response-mapper';

const feeConfig = {
  kind: 'zerox' as const,
  aggregatorName: '0x',
  chain: 'ethereum' as const,
  mode: 'enforced' as const,
  feeType: 'native fee' as const,
  feeBps: 100,
  feeAssetSide: 'buy' as const,
  feeAssetAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  feeAssetSymbol: 'USDC',
  feeAppliedAtQuote: true,
  feeEnforcedOnExecution: true,
  feeRecipient: '0x1111111111111111111111111111111111111111',
  feeTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
};

describe('toZeroXQuoteResponse', () => {
  it('должен сохранять gross и fee из provider breakdown', () => {
    const result = toZeroXQuoteResponse(
      '0x',
      {
        chain: 'ethereum',
        sellTokenAddress: '0x1',
        buyTokenAddress: '0x2',
        sellAmountBaseUnits: '1',
        sellTokenDecimals: 18,
        buyTokenDecimals: 6,
        feeConfig,
      },
      {
        buyAmount: '990000',
        liquidityAvailable: true,
        totalNetworkFee: null,
        fees: { integratorFee: { amount: '10000' } },
      },
    );

    expect(result.toAmountBaseUnits).toBe('990000');
    expect(result.feeAmountBaseUnits).toBe('10000');
    expect(result.grossToAmountBaseUnits).toBe('1000000');
  });
});
