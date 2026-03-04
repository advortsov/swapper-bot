import { describe, expect, it } from 'vitest';

import { OdosExecutionBuilder } from '../../src/aggregators/odos/odos.execution-builder';
import { createDisabledFeeConfig } from '../support/fee.fixtures';

const builder = new OdosExecutionBuilder();

describe('OdosExecutionBuilder', () => {
  it('должен собирать quote payload для execution', () => {
    const payload = builder.buildQuotePayload({
      chain: 'ethereum',
      sellTokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      buyTokenAddress: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      sellAmountBaseUnits: '1',
      sellTokenDecimals: 18,
      buyTokenDecimals: 6,
      fromAddress: '0x000000000000000000000000000000000000dEaD',
      slippagePercentage: 0.5,
      feeConfig: createDisabledFeeConfig('odos', 'ethereum'),
    }) as { chainId: number; inputTokens: { tokenAddress: string }[] };

    expect(payload.chainId).toBe(1);
    expect(payload.inputTokens[0]?.tokenAddress).toBe('0x0000000000000000000000000000000000000000');
  });

  it('должен собирать evm transaction из assemble response', () => {
    const tx = builder.buildSwapTransaction(
      '0xdead',
      { outAmounts: ['1'], pathId: 'path' },
      { transaction: { to: '0x1', data: '0x2', value: '0' } },
    );
    expect(tx).toEqual({ kind: 'evm', to: '0x1', data: '0x2', value: '0' });
  });
});
