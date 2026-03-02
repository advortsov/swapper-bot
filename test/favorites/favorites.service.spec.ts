import { describe, expect, it, vi } from 'vitest';

import { FavoritesService } from '../../src/favorites/favorites.service';

describe('FavoritesService', () => {
  it('должен получать текущую лучшую котировку для избранной пары', async () => {
    const service = new FavoritesService(
      {
        create: vi.fn(),
        listByUser: vi.fn(),
        findById: vi.fn(),
        delete: vi.fn(),
      } as never,
      {
        prepare: vi.fn().mockResolvedValue({ prepared: true }),
        fetchQuoteSelection: vi.fn().mockResolvedValue({ selection: true }),
        buildResponse: vi
          .fn()
          .mockReturnValue({ aggregator: 'paraswap', toAmount: '200', toSymbol: 'USDC' }),
      } as never,
    );

    const result = await service.getBestQuoteForFavorite({
      id: 'fav-1',
      userId: '42',
      chain: 'ethereum',
      amount: '0.1',
      fromTokenChain: 'ethereum',
      fromTokenAddress: '0xeeee',
      toTokenChain: 'ethereum',
      toTokenAddress: '0xa0b8',
      createdAt: new Date(),
      fromTokenSymbol: 'ETH',
      toTokenSymbol: 'USDC',
    });

    expect(result.aggregator).toBe('paraswap');
    expect(result.toAmount).toBe('200');
  });
});
