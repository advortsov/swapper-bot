import { describe, expect, it } from 'vitest';

import { buildParaSwapQuoteUrl } from '../../src/aggregators/para-swap/para-swap.quote-builder';

const feeConfig = {
  kind: 'paraswap' as const,
  aggregatorName: 'paraswap',
  chain: 'ethereum' as const,
  mode: 'enforced' as const,
  feeType: 'partner fee' as const,
  feeBps: 15,
  feeAssetSide: 'buy' as const,
  feeAssetAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  feeAssetSymbol: 'USDC',
  feeAppliedAtQuote: true,
  feeEnforcedOnExecution: true,
  partnerAddress: '0x1111111111111111111111111111111111111111',
  partnerName: 'swapper',
};

describe('buildParaSwapQuoteUrl', () => {
  it('должен добавлять partner fee params', () => {
    const url = buildParaSwapQuoteUrl('https://api.paraswap.io', '6.2', {
      chain: 'ethereum',
      sellTokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      buyTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      sellAmountBaseUnits: '1',
      sellTokenDecimals: 18,
      buyTokenDecimals: 6,
      feeConfig,
    });

    expect(String(url)).toContain('partnerAddress=0x1111111111111111111111111111111111111111');
    expect(String(url)).toContain('partnerFeeBps=15');
  });
});
