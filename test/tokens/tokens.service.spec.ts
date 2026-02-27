import { describe, expect, it, vi } from 'vitest';

import type { ChainType } from '../../src/chains/interfaces/chain.interface';
import { SUPPORTED_CHAINS } from '../../src/chains/interfaces/chain.interface';
import type { ITokenRecord } from '../../src/tokens/tokens.repository';
import type { TokensRepository } from '../../src/tokens/tokens.repository';
import { TokensService } from '../../src/tokens/tokens.service';

describe('TokensService', () => {
  it('должен делать reseed для всех поддерживаемых сетей на старте', async () => {
    const upsertTokens = vi.fn().mockResolvedValue(undefined);
    const findBySymbol = vi.fn();
    const tokensRepository: Pick<TokensRepository, 'upsertTokens' | 'findBySymbol'> = {
      upsertTokens,
      findBySymbol,
    };
    const service = new TokensService(tokensRepository as TokensRepository);

    await service.onModuleInit();

    expect(upsertTokens).toHaveBeenCalledTimes(SUPPORTED_CHAINS.length);

    const seededChains = upsertTokens.mock.calls.map((call) => {
      const tokenList = call[0] as readonly { chain: ChainType }[];
      return tokenList[0]?.chain;
    });

    expect(new Set(seededChains)).toEqual(new Set(SUPPORTED_CHAINS));
  });

  it('должен искать токен с учетом сети', async () => {
    const upsertTokens = vi.fn().mockResolvedValue(undefined);
    const token: ITokenRecord = {
      address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      symbol: 'ETH',
      decimals: 18,
      name: 'Ether',
      chain: 'arbitrum',
    };
    const findBySymbol = vi.fn().mockResolvedValue(token);
    const tokensRepository: Pick<TokensRepository, 'upsertTokens' | 'findBySymbol'> = {
      upsertTokens,
      findBySymbol,
    };
    const service = new TokensService(tokensRepository as TokensRepository);

    const result = await service.getTokenBySymbol('ETH', 'arbitrum');

    expect(findBySymbol).toHaveBeenCalledWith('ETH', 'arbitrum');
    expect(result.chain).toBe('arbitrum');
  });
});
