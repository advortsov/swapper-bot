import { describe, expect, it } from 'vitest';

import { AllowanceTransactionService } from '../../src/allowance/allowance-transaction.service';

describe('AllowanceTransactionService', () => {
  it('должен строить approve transaction и callback data', () => {
    const service = new AllowanceTransactionService();

    const transaction = service.buildApproveTransaction({
      chain: 'arbitrum',
      tokenSymbol: 'USDC',
      tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      tokenDecimals: 6,
      spenderAddress: '0x1111111111111111111111111111111111111111',
      aggregatorName: 'paraswap',
      mode: 'exact',
      currentAllowanceBaseUnits: '0',
      amount: '10',
      amountBaseUnits: '10000000',
      approveAmountBaseUnits: '10000000',
    });

    expect(transaction.to).toBe('0xaf88d065e77c8cC2239327C5EDb3A432268e5831');
    expect(transaction.value).toBe('0');
    expect(transaction.data.startsWith('0x')).toBe(true);
    expect(service.buildApprovalCallbackData('token', 'paraswap', 'max')).toBe(
      'apr:token:paraswap:max',
    );
  });
});
