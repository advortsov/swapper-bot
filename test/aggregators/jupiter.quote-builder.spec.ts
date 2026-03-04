import { describe, expect, it } from 'vitest';

import {
  buildJupiterQuoteUrl,
  toJupiterSlippageBps,
} from '../../src/aggregators/jupiter/jupiter.quote-builder';

describe('buildJupiterQuoteUrl', () => {
  it('должен добавлять platformFeeBps для enforced Jupiter fee config', () => {
    const url = buildJupiterQuoteUrl({
      apiBaseUrl: 'https://lite-api.jup.ag',
      inputMint: 'So11111111111111111111111111111111111111112',
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      amount: '100000000',
      feeConfig: {
        kind: 'jupiter',
        aggregatorName: 'jupiter',
        chain: 'solana',
        mode: 'enforced',
        feeType: 'native fee',
        feeBps: 20,
        feeAssetSide: 'buy',
        feeAssetAddress: 'mint',
        feeAssetSymbol: 'USDC',
        feeAppliedAtQuote: true,
        feeEnforcedOnExecution: true,
        feeAccount: 'fee-account',
        feeMintAddress: 'mint',
      },
    });

    expect(url.searchParams.get('platformFeeBps')).toBe('20');
  });

  it('должен переводить slippage percentage в bps с нижней границей 1', () => {
    expect(toJupiterSlippageBps(0.5)).toBe('50');
    expect(toJupiterSlippageBps(0)).toBe('1');
  });
});
