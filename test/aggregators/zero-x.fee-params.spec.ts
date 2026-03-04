import { describe, expect, it } from 'vitest';

import { applyZeroXFeeParams } from '../../src/aggregators/zero-x/zero-x.fee-params';

describe('applyZeroXFeeParams', () => {
  it('должен добавлять integrator fee params', () => {
    const url = new URL('https://api.0x.org/swap/allowance-holder/quote');

    applyZeroXFeeParams(url, {
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
    });

    expect(String(url)).toContain('swapFeeRecipient=0x1111111111111111111111111111111111111111');
    expect(String(url)).toContain('swapFeeBps=25');
    expect(String(url)).toContain('swapFeeToken=0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48');
  });
});
