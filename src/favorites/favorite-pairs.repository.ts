import { Injectable } from '@nestjs/common';

import type { ChainType } from '../chains/interfaces/chain.interface';
import { DatabaseService } from '../database/database.service';
import type {
  ICreateFavoriteInput,
  IFavoritePairRecord,
  IFavoritePairView,
} from './interfaces/favorite-pair.interface';

@Injectable()
export class FavoritePairsRepository {
  public constructor(private readonly databaseService: DatabaseService) {}

  public async create(input: ICreateFavoriteInput): Promise<IFavoritePairRecord> {
    const favorite = await this.databaseService
      .getConnection()
      .insertInto('favorite_pairs')
      .values({
        user_id: input.userId,
        chain: input.chain,
        amount: input.amount,
        from_token_chain: input.fromTokenChain,
        from_token_address: input.fromTokenAddress,
        to_token_chain: input.toTokenChain,
        to_token_address: input.toTokenAddress,
      })
      .onConflict((conflict) =>
        conflict
          .columns(['user_id', 'chain', 'amount', 'from_token_address', 'to_token_address'])
          .doNothing(),
      )
      .returning([
        'id',
        'user_id as userId',
        'chain',
        'amount',
        'from_token_chain as fromTokenChain',
        'from_token_address as fromTokenAddress',
        'to_token_chain as toTokenChain',
        'to_token_address as toTokenAddress',
        'created_at as createdAt',
      ])
      .executeTakeFirst();

    if (favorite) {
      return this.mapRecord(favorite);
    }

    const existing = await this.findByPair(input);

    if (!existing) {
      throw new Error('Favorite pair was not created');
    }

    return existing;
  }

  public async findByPair(input: ICreateFavoriteInput): Promise<IFavoritePairRecord | null> {
    const favorite = await this.databaseService
      .getConnection()
      .selectFrom('favorite_pairs')
      .select([
        'id',
        'user_id as userId',
        'chain',
        'amount',
        'from_token_chain as fromTokenChain',
        'from_token_address as fromTokenAddress',
        'to_token_chain as toTokenChain',
        'to_token_address as toTokenAddress',
        'created_at as createdAt',
      ])
      .where('user_id', '=', input.userId)
      .where('chain', '=', input.chain)
      .where('amount', '=', input.amount)
      .where('from_token_address', '=', input.fromTokenAddress)
      .where('to_token_address', '=', input.toTokenAddress)
      .executeTakeFirst();

    return favorite ? this.mapRecord(favorite) : null;
  }

  public async findById(id: string, userId: string): Promise<IFavoritePairView | null> {
    const favorite = await this.databaseService
      .getConnection()
      .selectFrom('favorite_pairs')
      .innerJoin('tokens as from_token', (join) =>
        join
          .onRef('from_token.address', '=', 'favorite_pairs.from_token_address')
          .onRef('from_token.chain', '=', 'favorite_pairs.from_token_chain'),
      )
      .innerJoin('tokens as to_token', (join) =>
        join
          .onRef('to_token.address', '=', 'favorite_pairs.to_token_address')
          .onRef('to_token.chain', '=', 'favorite_pairs.to_token_chain'),
      )
      .select([
        'favorite_pairs.id as id',
        'favorite_pairs.user_id as userId',
        'favorite_pairs.chain as chain',
        'favorite_pairs.amount as amount',
        'favorite_pairs.from_token_chain as fromTokenChain',
        'favorite_pairs.from_token_address as fromTokenAddress',
        'favorite_pairs.to_token_chain as toTokenChain',
        'favorite_pairs.to_token_address as toTokenAddress',
        'favorite_pairs.created_at as createdAt',
        'from_token.symbol as fromTokenSymbol',
        'to_token.symbol as toTokenSymbol',
      ])
      .where('favorite_pairs.id', '=', id)
      .where('favorite_pairs.user_id', '=', userId)
      .executeTakeFirst();

    return favorite ? this.mapView(favorite) : null;
  }

  public async listByUser(userId: string): Promise<readonly IFavoritePairView[]> {
    const favorites = await this.databaseService
      .getConnection()
      .selectFrom('favorite_pairs')
      .innerJoin('tokens as from_token', (join) =>
        join
          .onRef('from_token.address', '=', 'favorite_pairs.from_token_address')
          .onRef('from_token.chain', '=', 'favorite_pairs.from_token_chain'),
      )
      .innerJoin('tokens as to_token', (join) =>
        join
          .onRef('to_token.address', '=', 'favorite_pairs.to_token_address')
          .onRef('to_token.chain', '=', 'favorite_pairs.to_token_chain'),
      )
      .select([
        'favorite_pairs.id as id',
        'favorite_pairs.user_id as userId',
        'favorite_pairs.chain as chain',
        'favorite_pairs.amount as amount',
        'favorite_pairs.from_token_chain as fromTokenChain',
        'favorite_pairs.from_token_address as fromTokenAddress',
        'favorite_pairs.to_token_chain as toTokenChain',
        'favorite_pairs.to_token_address as toTokenAddress',
        'favorite_pairs.created_at as createdAt',
        'from_token.symbol as fromTokenSymbol',
        'to_token.symbol as toTokenSymbol',
      ])
      .where('favorite_pairs.user_id', '=', userId)
      .orderBy('favorite_pairs.created_at', 'desc')
      .execute();

    return favorites.map((favorite) => this.mapView(favorite));
  }

  public async delete(id: string, userId: string): Promise<boolean> {
    const result = await this.databaseService
      .getConnection()
      .deleteFrom('favorite_pairs')
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    return Number(result.numDeletedRows) > 0;
  }

  private mapRecord(record: {
    id: string;
    userId: string;
    chain: string;
    amount: string;
    fromTokenChain: string;
    fromTokenAddress: string;
    toTokenChain: string;
    toTokenAddress: string;
    createdAt: Date;
  }): IFavoritePairRecord {
    return {
      ...record,
      chain: record.chain as ChainType,
      fromTokenChain: record.fromTokenChain as ChainType,
      toTokenChain: record.toTokenChain as ChainType,
    };
  }

  private mapView(view: {
    id: string;
    userId: string;
    chain: string;
    amount: string;
    fromTokenChain: string;
    fromTokenAddress: string;
    toTokenChain: string;
    toTokenAddress: string;
    createdAt: Date;
    fromTokenSymbol: string;
    toTokenSymbol: string;
  }): IFavoritePairView {
    return {
      ...this.mapRecord(view),
      fromTokenSymbol: view.fromTokenSymbol,
      toTokenSymbol: view.toTokenSymbol,
    };
  }
}
