import { describe, expect, it, vi } from 'vitest';

import { AllowanceContextService } from '../../src/allowance/allowance-context.service';

describe('AllowanceContextService', () => {
  it('должен разрешать ERC-20 токен в EVM сети', async () => {
    const tokenAddressResolverService = {
      resolveTokenInput: vi.fn().mockResolvedValue({
        symbol: 'USDC',
        address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        decimals: 6,
      }),
    };
    const service = new AllowanceContextService(tokenAddressResolverService as never);

    const result = await service.resolveApproveContext({
      userId: '42',
      amount: '1.5',
      tokenInput: 'USDC',
      chain: 'arbitrum',
      explicitChain: true,
      walletAddress: null,
    });

    expect(result).toEqual({
      chain: 'arbitrum',
      tokenSymbol: 'USDC',
      tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      tokenDecimals: 6,
      amount: '1.5',
      amountBaseUnits: '1500000',
    });
  });

  it('должен отклонять approve для non-EVM сети', async () => {
    const tokenAddressResolverService = {
      resolveTokenInput: vi.fn(),
    };
    const service = new AllowanceContextService(tokenAddressResolverService as never);

    await expect(
      service.resolveApproveContext({
        userId: '42',
        amount: '1',
        tokenInput: 'USDC',
        chain: 'solana',
        explicitChain: true,
        walletAddress: null,
      }),
    ).rejects.toThrowError('Approve поддержан только для EVM-сетей');
  });

  it('должен отклонять approve для нативного токена', async () => {
    const tokenAddressResolverService = {
      resolveTokenInput: vi.fn().mockResolvedValue({
        symbol: 'ETH',
        address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        decimals: 18,
      }),
    };
    const service = new AllowanceContextService(tokenAddressResolverService as never);

    await expect(
      service.resolveApproveContext({
        userId: '42',
        amount: '1',
        tokenInput: 'ETH',
        chain: 'arbitrum',
        explicitChain: true,
        walletAddress: null,
      }),
    ).rejects.toThrowError('Токен ETH нативный и не требует approve в сети arbitrum');
  });
});
