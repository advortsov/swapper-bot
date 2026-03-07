import { Injectable } from '@nestjs/common';

import type { ChainType } from '../chains/interfaces/chain.interface';
import { DatabaseService } from '../database/database.service';
import type { ITokenSeed } from './seed/token-seed.interface';

export interface ITokenRecord {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  chain: ChainType;
}

@Injectable()
export class TokensRepository {
  public constructor(private readonly databaseService: DatabaseService) {}

  public async upsertTokens(tokens: readonly ITokenSeed[]): Promise<void> {
    await Promise.all(tokens.map(async (token) => this.upsertToken(token)));
  }

  public async upsertToken(token: ITokenSeed): Promise<void> {
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
        conflict.columns(['chain', 'address']).doUpdateSet({
          symbol: token.symbol,
          decimals: token.decimals,
          name: token.name,
          chain: token.chain,
          updated_at: new Date(),
        }),
      )
      .execute();
  }

  public async findBySymbol(symbol: string, chain: ChainType): Promise<ITokenRecord | null> {
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
      chain: token.chain as ChainType,
    };
  }

  public async findByAddress(address: string, chain: ChainType): Promise<ITokenRecord | null> {
    return this.findByAddressAndChain(address, chain);
  }

  public async findByAddressAndChain(
    address: string,
    chain: ChainType,
  ): Promise<ITokenRecord | null> {
    const token = await this.databaseService
      .getConnection()
      .selectFrom('tokens')
      .select(['address', 'symbol', 'decimals', 'name', 'chain'])
      .where('address', '=', address)
      .where('chain', '=', chain)
      .executeTakeFirst();

    return token ? this.mapRecord(token) : null;
  }

  private mapRecord(token: {
    address: string;
    symbol: string;
    decimals: number;
    name: string;
    chain: string;
  }): ITokenRecord {
    return {
      address: token.address,
      symbol: token.symbol,
      decimals: token.decimals,
      name: token.name,
      chain: token.chain as ChainType,
    };
  }
}
