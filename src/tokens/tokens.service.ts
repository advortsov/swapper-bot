import { Injectable, OnModuleInit } from '@nestjs/common';

import { ETHEREUM_TOKENS_SEED } from './seed/ethereum.tokens.seed';
import { TokensRepository } from './tokens.repository';
import type { ITokenRecord } from './tokens.repository';
import { BusinessException } from '../common/exceptions/business.exception';

const ETHEREUM_CHAIN = 'ethereum';

@Injectable()
export class TokensService implements OnModuleInit {
  public constructor(private readonly tokensRepository: TokensRepository) {}

  public async onModuleInit(): Promise<void> {
    const count = await this.tokensRepository.countByChain(ETHEREUM_CHAIN);

    if (count === 0) {
      await this.tokensRepository.upsertTokens(ETHEREUM_TOKENS_SEED);
    }
  }

  public async getTokenBySymbol(symbol: string): Promise<ITokenRecord> {
    const token = await this.tokensRepository.findBySymbol(symbol, ETHEREUM_CHAIN);

    if (!token) {
      throw new BusinessException(`Токен ${symbol.toUpperCase()} не поддерживается`);
    }

    return token;
  }
}
