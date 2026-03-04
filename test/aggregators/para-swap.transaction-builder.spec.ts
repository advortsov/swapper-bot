import { describe, expect, it } from 'vitest';

import {
  buildParaSwapTransactionBody,
  buildParaSwapTransactionUrl,
} from '../../src/aggregators/para-swap/para-swap.transaction-builder';

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

describe('para-swap.transaction-builder', () => {
  it('должен собирать transaction url', () => {
    expect(String(buildParaSwapTransactionUrl('https://api.paraswap.io', 'arbitrum'))).toContain(
      '/transactions/42161',
    );
  });

  it('должен передавать partner fee params в body', () => {
    const body = buildParaSwapTransactionBody(
      {
        chain: 'ethereum',
        sellTokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        buyTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        sellAmountBaseUnits: '1',
        sellTokenDecimals: 18,
        buyTokenDecimals: 6,
        fromAddress: '0xdead',
        slippagePercentage: 0.5,
        feeConfig,
      },
      { destAmount: '1000000' },
    );

    expect(body['partnerAddress']).toBe('0x1111111111111111111111111111111111111111');
    expect(body['partnerFeeBps']).toBe(15);
  });
});
