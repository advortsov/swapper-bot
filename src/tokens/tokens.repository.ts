import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import type { IEthereumTokenSeed } from './seed/ethereum.tokens.seed';

export interface ITokenRecord {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  chain: string;
}

@Injectable()
export class TokensRepository {
  public constructor(private readonly databaseService: DatabaseService) {}

  public async countByChain(chain: string): Promise<number> {
    const result = await this.databaseService
      .getConnection()
      .selectFrom('tokens')
      .select((expressionBuilder) => expressionBuilder.fn.countAll<string | number>().as('count'))
      .where('chain', '=', chain)
      .executeTakeFirst();

    const value = result?.count;

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      return Number.parseInt(value, 10);
    }

    return 0;
  }

  public async upsertTokens(tokens: readonly IEthereumTokenSeed[]): Promise<void> {
    await Promise.all(tokens.map(async (token) => this.upsertToken(token)));
  }

  public async findBySymbol(symbol: string, chain: string): Promise<ITokenRecord | null> {
    const token = await this.databaseService
      .getConnection()
      .selectFrom('tokens')
      .select(['address', 'symbol', 'decimals', 'name', 'chain'])
      .where('symbol', '=', symbol.toUpperCase())
      .where('chain', '=', chain)
      .executeTakeFirst();

    if (!token) {
      return null;
    }

    return {
      address: token.address,
      symbol: token.symbol,
      decimals: token.decimals,
      name: token.name,
      chain: token.chain,
    };
  }

  private async upsertToken(token: IEthereumTokenSeed): Promise<void> {
    await this.databaseService
      .getConnection()
      .insertInto('tokens')
      .values({
        address: token.address,
        symbol: token.symbol,
        decimals: token.decimals,
        name: token.name,
        chain: token.chain,
      })
      .onConflict((conflict) =>
        conflict.column('address').doUpdateSet({
          symbol: token.symbol,
          decimals: token.decimals,
          name: token.name,
          chain: token.chain,
          updated_at: new Date(),
        }),
      )
      .execute();
  }
}
