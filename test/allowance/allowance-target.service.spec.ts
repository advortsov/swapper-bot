import { describe, expect, it, vi } from 'vitest';

import type { IAggregator } from '../../src/aggregators/interfaces/aggregator.interface';
import { AllowanceTargetService } from '../../src/allowance/allowance-target.service';

describe('AllowanceTargetService', () => {
  it('должен игнорировать агрегатор с ошибкой если другой вернул spender', async () => {
    const aggregators: readonly IAggregator[] = [
      {
        name: 'paraswap',
        supportedChains: ['arbitrum'],
        getQuote: vi.fn(),
        buildSwapTransaction: vi.fn(),
        resolveApprovalTarget: vi.fn().mockResolvedValue({
          spenderAddress: '0x1111111111111111111111111111111111111111',
        }),
        healthCheck: vi.fn(),
      },
      {
        name: 'odos',
        supportedChains: ['arbitrum'],
        getQuote: vi.fn(),
        buildSwapTransaction: vi.fn(),
        resolveApprovalTarget: vi.fn().mockRejectedValue(new Error('boom')),
        healthCheck: vi.fn(),
      },
    ];
    const allowanceReaderService = {
      readAllowance: vi.fn().mockResolvedValue({ allowanceBaseUnits: '1000000' }),
    };
    const tokensService = {
      getTokenBySymbol: vi.fn().mockResolvedValue({
        address: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
      }),
    };
    const service = new AllowanceTargetService(
      aggregators,
      allowanceReaderService as never,
      tokensService as never,
    );

    const result = await service.resolveApprovalOptions({
      chain: 'arbitrum',
      tokenSymbol: 'USDC',
      tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      tokenDecimals: 6,
      amount: '1',
      amountBaseUnits: '1000000',
      walletAddress: '0x000000000000000000000000000000000000dEaD',
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      aggregatorName: 'paraswap',
      spenderAddress: '0x1111111111111111111111111111111111111111',
      currentAllowance: '1',
      currentAllowanceBaseUnits: '1000000',
    });
  });

  it('должен выбирать WETH как quote target для USDC', async () => {
    const tokensService = {
      getTokenBySymbol: vi.fn().mockResolvedValue({
        address: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
      }),
    };
    const aggregator: IAggregator = {
      name: 'paraswap',
      supportedChains: ['arbitrum'],
      getQuote: vi.fn(),
      buildSwapTransaction: vi.fn(),
      resolveApprovalTarget: vi.fn().mockResolvedValue({
        spenderAddress: '0x1111111111111111111111111111111111111111',
      }),
      healthCheck: vi.fn(),
    };
    const service = new AllowanceTargetService(
      [aggregator],
      { readAllowance: vi.fn() } as never,
      tokensService as never,
    );

    await service.resolveApprovalOptions({
      chain: 'arbitrum',
      tokenSymbol: 'USDC',
      tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      tokenDecimals: 6,
      amount: '1',
      amountBaseUnits: '1000000',
      walletAddress: null,
    });

    expect(tokensService.getTokenBySymbol).toHaveBeenCalledWith('WETH', 'arbitrum');
  });

  it('должен падать если агрегатор не поддерживает approve flow', async () => {
    const service = new AllowanceTargetService(
      [],
      { readAllowance: vi.fn() } as never,
      {
        getTokenBySymbol: vi.fn(),
      } as never,
    );

    await expect(
      service.resolveApprovalTarget({
        aggregatorName: 'missing',
        chain: 'arbitrum',
        sellTokenAddress: '0x1',
        buyTokenAddress: '0x2',
        sellAmountBaseUnits: '1',
        userAddress: '0x000000000000000000000000000000000000dEaD',
      }),
    ).rejects.toThrowError('Aggregator missing does not support approve flow');
  });
});
