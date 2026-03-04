import { describe, expect, it, vi } from 'vitest';

import { AllowanceGuardService } from '../../src/allowance/allowance-guard.service';
import { InsufficientAllowanceException } from '../../src/allowance/insufficient-allowance.exception';

describe('AllowanceGuardService', () => {
  it('должен пропускать non-EVM цепочку', async () => {
    const service = new AllowanceGuardService(
      { createInsufficientAllowanceAction: vi.fn() } as never,
      {
        isEvmChain: vi.fn().mockReturnValue(false),
        isNativeTokenAddress: vi.fn(),
      } as never,
      { readAllowance: vi.fn() } as never,
      { resolveApprovalTarget: vi.fn() } as never,
    );

    await expect(
      service.ensureSufficientAllowance({
        userId: '42',
        chain: 'solana',
        aggregatorName: 'jupiter',
        walletAddress: 'wallet',
        tokenSymbol: 'USDC',
        tokenAddress: 'mint',
        tokenDecimals: 6,
        buyTokenAddress: 'buy',
        amount: '10',
        amountBaseUnits: '10000000',
      }),
    ).resolves.toBeUndefined();
  });

  it('должен ничего не делать при достаточном allowance', async () => {
    const service = new AllowanceGuardService(
      { createInsufficientAllowanceAction: vi.fn() } as never,
      {
        isEvmChain: vi.fn().mockReturnValue(true),
        isNativeTokenAddress: vi.fn().mockReturnValue(false),
      } as never,
      { readAllowance: vi.fn().mockResolvedValue({ allowanceBaseUnits: '10000000' }) } as never,
      {
        resolveApprovalTarget: vi.fn().mockResolvedValue({
          spenderAddress: '0x1111111111111111111111111111111111111111',
        }),
      } as never,
    );

    await expect(
      service.ensureSufficientAllowance({
        userId: '42',
        chain: 'arbitrum',
        aggregatorName: 'paraswap',
        walletAddress: '0x000000000000000000000000000000000000dEaD',
        tokenSymbol: 'USDC',
        tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        tokenDecimals: 6,
        buyTokenAddress: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
        amount: '10',
        amountBaseUnits: '10000000',
      }),
    ).resolves.toBeUndefined();
  });

  it('должен бросать InsufficientAllowanceException при недостаточном allowance', async () => {
    const service = new AllowanceGuardService(
      { createInsufficientAllowanceAction: vi.fn().mockReturnValue('action-token') } as never,
      {
        isEvmChain: vi.fn().mockReturnValue(true),
        isNativeTokenAddress: vi.fn().mockReturnValue(false),
      } as never,
      { readAllowance: vi.fn().mockResolvedValue({ allowanceBaseUnits: '10' }) } as never,
      {
        resolveApprovalTarget: vi.fn().mockResolvedValue({
          spenderAddress: '0x1111111111111111111111111111111111111111',
        }),
      } as never,
    );

    await expect(
      service.ensureSufficientAllowance({
        userId: '42',
        chain: 'arbitrum',
        aggregatorName: 'paraswap',
        walletAddress: '0x000000000000000000000000000000000000dEaD',
        tokenSymbol: 'USDC',
        tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        tokenDecimals: 6,
        buyTokenAddress: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
        amount: '10',
        amountBaseUnits: '10000000',
      }),
    ).rejects.toBeInstanceOf(InsufficientAllowanceException);
  });
});
