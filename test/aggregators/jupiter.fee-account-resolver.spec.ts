import { describe, expect, it } from 'vitest';

import { resolveJupiterFeeAccount } from '../../src/aggregators/jupiter/jupiter.fee-account-resolver';

describe('resolveJupiterFeeAccount', () => {
  it('должен возвращать feeAccount только для enforced Jupiter config', () => {
    expect(
      resolveJupiterFeeAccount({
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
      }),
    ).toBe('fee-account');

    expect(
      resolveJupiterFeeAccount({
        kind: 'none',
        aggregatorName: 'jupiter',
        chain: 'solana',
        mode: 'disabled',
        feeType: 'no fee',
        feeBps: 0,
        feeAssetSide: 'none',
        feeAssetAddress: null,
        feeAssetSymbol: null,
        feeAppliedAtQuote: false,
        feeEnforcedOnExecution: false,
      }),
    ).toBeUndefined();
  });
});
