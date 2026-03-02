import { describe, expect, it, vi } from 'vitest';

import { BusinessException } from '../../src/common/exceptions/business.exception';
import { TokenAddressResolverService } from '../../src/token-resolution/token-address-resolver.service';

describe('TokenAddressResolverService', () => {
  it('должен резолвить адрес токена через CoinGecko и сохранять его', async () => {
    const tokensService = {
      getTokenBySymbol: vi.fn(),
      getTokenByAddress: vi.fn().mockRejectedValue(new Error('not found')),
      upsertToken: vi.fn().mockResolvedValue({
        address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        chain: 'ethereum',
      }),
    };
    const service = new TokenAddressResolverService(
      {
        getTokenByContract: vi.fn().mockResolvedValue({
          symbol: 'usdc',
          name: 'USD Coin',
          detail_platforms: {
            ethereum: {
              contract_address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
              decimal_place: 6,
            },
          },
        }),
      } as never,
      tokensService as never,
      [{ name: 'ethereum', validateAddress: () => true }] as never,
    );

    const token = await service.resolveTokenInput(
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      'ethereum',
      true,
    );

    expect(token.symbol).toBe('USDC');
    expect(tokensService.upsertToken).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: 'USDC', decimals: 6 }),
    );
  });

  it('должен требовать явную сеть для адреса токена', async () => {
    const service = new TokenAddressResolverService(
      { getTokenByContract: vi.fn() } as never,
      { getTokenBySymbol: vi.fn(), getTokenByAddress: vi.fn(), upsertToken: vi.fn() } as never,
      [{ name: 'ethereum', validateAddress: () => true }] as never,
    );

    await expect(
      service.resolveTokenInput('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 'ethereum', false),
    ).rejects.toThrowError(BusinessException);
  });
});
