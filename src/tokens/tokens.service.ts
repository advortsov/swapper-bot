import { Injectable, OnModuleInit } from '@nestjs/common';

import { ARBITRUM_TOKENS_SEED } from './seed/arbitrum.tokens.seed';
import { BASE_TOKENS_SEED } from './seed/base.tokens.seed';
import { ETHEREUM_TOKENS_SEED } from './seed/ethereum.tokens.seed';
import { OPTIMISM_TOKENS_SEED } from './seed/optimism.tokens.seed';
import { SOLANA_TOKENS_SEED } from './seed/solana.tokens.seed';
import type { ITokenSeed } from './seed/token-seed.interface';
import { TokensRepository } from './tokens.repository';
import type { ITokenRecord } from './tokens.repository';
import { SUPPORTED_CHAINS, type ChainType } from '../chains/interfaces/chain.interface';
import { BusinessException } from '../common/exceptions/business.exception';

@Injectable()
export class TokensService implements OnModuleInit {
  private readonly seedByChain: Readonly<Record<ChainType, readonly ITokenSeed[]>> = {
    ethereum: ETHEREUM_TOKENS_SEED,
    arbitrum: ARBITRUM_TOKENS_SEED,
    base: BASE_TOKENS_SEED,
    optimism: OPTIMISM_TOKENS_SEED,
    solana: SOLANA_TOKENS_SEED,
  };

  public constructor(private readonly tokensRepository: TokensRepository) {}

  public async onModuleInit(): Promise<void> {
    for (const chain of SUPPORTED_CHAINS) {
      await this.tokensRepository.upsertTokens(this.seedByChain[chain]);
    }
  }

  public async getTokenBySymbol(symbol: string, chain: ChainType): Promise<ITokenRecord> {
    const token = await this.tokensRepository.findBySymbol(symbol, chain);

    if (!token) {
      throw new BusinessException(
        `Токен ${symbol.toUpperCase()} не поддерживается в сети ${chain}`,
      );
    }

    return token;
  }
}
