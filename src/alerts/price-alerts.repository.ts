import { Injectable } from '@nestjs/common';

import type { ChainType } from '../chains/interfaces/chain.interface';
import { DatabaseService } from '../database/database.service';
import type {
  ICreatePriceAlertInput,
  IPriceAlertRecord,
  IPriceAlertWithFavorite,
  PriceAlertStatus,
} from './interfaces/price-alert.interface';

@Injectable()
export class PriceAlertsRepository {
  public constructor(private readonly databaseService: DatabaseService) {}

  public async upsertActiveAlert(input: ICreatePriceAlertInput): Promise<IPriceAlertRecord> {
    const existing = await this.databaseService
      .getConnection()
      .selectFrom('price_alerts')
      .select(['id'])
      .where('favorite_id', '=', input.favoriteId)
      .where('status', '=', 'active')
      .executeTakeFirst();

    if (existing) {
      const updated = await this.databaseService
        .getConnection()
        .updateTable('price_alerts')
        .set({
          target_to_amount: input.targetToAmount,
          updated_at: new Date(),
          last_checked_at: null,
          triggered_at: null,
          last_observed_net_to_amount: null,
          last_observed_aggregator: null,
        })
        .where('id', '=', existing.id)
        .returningAll()
        .executeTakeFirstOrThrow();

      return this.mapRecord(updated);
    }

    const created = await this.databaseService
      .getConnection()
      .insertInto('price_alerts')
      .values({
        favorite_id: input.favoriteId,
        user_id: input.userId,
        target_to_amount: input.targetToAmount,
        status: 'active',
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapRecord(created);
  }

  public async countActiveByUser(userId: string): Promise<number> {
    const result = await this.databaseService
      .getConnection()
      .selectFrom('price_alerts')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('user_id', '=', userId)
      .where('status', '=', 'active')
      .executeTakeFirstOrThrow();

    return Number(result.count);
  }

  public async findActiveByFavorite(favoriteId: string): Promise<IPriceAlertRecord | null> {
    const alert = await this.databaseService
      .getConnection()
      .selectFrom('price_alerts')
      .selectAll()
      .where('favorite_id', '=', favoriteId)
      .where('status', '=', 'active')
      .executeTakeFirst();

    return alert ? this.mapRecord(alert) : null;
  }

  public async listActiveBatch(limit: number): Promise<readonly IPriceAlertWithFavorite[]> {
    const alerts = await this.databaseService
      .getConnection()
      .selectFrom('price_alerts')
      .innerJoin('favorite_pairs', 'favorite_pairs.id', 'price_alerts.favorite_id')
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
        'price_alerts.id as id',
        'price_alerts.favorite_id as favoriteId',
        'price_alerts.user_id as userId',
        'price_alerts.target_to_amount as targetToAmount',
        'price_alerts.status as status',
        'price_alerts.created_at as createdAt',
        'price_alerts.updated_at as updatedAt',
        'price_alerts.last_checked_at as lastCheckedAt',
        'price_alerts.triggered_at as triggeredAt',
        'price_alerts.last_observed_net_to_amount as lastObservedNetToAmount',
        'price_alerts.last_observed_aggregator as lastObservedAggregator',
        'favorite_pairs.chain as chain',
        'favorite_pairs.amount as amount',
        'favorite_pairs.from_token_address as fromTokenAddress',
        'favorite_pairs.to_token_address as toTokenAddress',
        'from_token.symbol as fromTokenSymbol',
        'to_token.symbol as toTokenSymbol',
      ])
      .where('price_alerts.status', '=', 'active')
      .orderBy('price_alerts.updated_at', 'asc')
      .limit(limit)
      .execute();

    return alerts.map((alert) => this.mapAlertWithFavorite(alert));
  }

  public async markObserved(
    alertId: string,
    input: { netToAmount: string; aggregator: string | null },
  ): Promise<void> {
    await this.databaseService
      .getConnection()
      .updateTable('price_alerts')
      .set({
        updated_at: new Date(),
        last_checked_at: new Date(),
        last_observed_net_to_amount: input.netToAmount,
        last_observed_aggregator: input.aggregator,
      })
      .where('id', '=', alertId)
      .execute();
  }

  public async markTriggered(
    alertId: string,
    input: { netToAmount: string; aggregator: string | null },
  ): Promise<void> {
    await this.databaseService
      .getConnection()
      .updateTable('price_alerts')
      .set({
        status: 'triggered',
        updated_at: new Date(),
        last_checked_at: new Date(),
        triggered_at: new Date(),
        last_observed_net_to_amount: input.netToAmount,
        last_observed_aggregator: input.aggregator,
      })
      .where('id', '=', alertId)
      .execute();
  }

  public async cancel(alertId: string, userId: string): Promise<boolean> {
    const result = await this.databaseService
      .getConnection()
      .updateTable('price_alerts')
      .set({
        status: 'cancelled',
        updated_at: new Date(),
      })
      .where('id', '=', alertId)
      .where('user_id', '=', userId)
      .where('status', '=', 'active')
      .executeTakeFirst();

    return Number(result.numUpdatedRows) > 0;
  }

  private mapRecord(record: {
    id: string;
    favorite_id: string;
    user_id: string;
    target_to_amount: string;
    status: string;
    created_at: Date;
    updated_at: Date;
    last_checked_at: Date | null;
    triggered_at: Date | null;
    last_observed_net_to_amount: string | null;
    last_observed_aggregator: string | null;
  }): IPriceAlertRecord {
    return {
      id: record.id,
      favoriteId: record.favorite_id,
      userId: record.user_id,
      targetToAmount: record.target_to_amount,
      status: record.status as PriceAlertStatus,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      lastCheckedAt: record.last_checked_at,
      triggeredAt: record.triggered_at,
      lastObservedNetToAmount: record.last_observed_net_to_amount,
      lastObservedAggregator: record.last_observed_aggregator,
    };
  }

  private mapAlertWithFavorite(alert: {
    id: string;
    favoriteId: string;
    userId: string;
    targetToAmount: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    lastCheckedAt: Date | null;
    triggeredAt: Date | null;
    lastObservedNetToAmount: string | null;
    lastObservedAggregator: string | null;
    chain: string;
    amount: string;
    fromTokenAddress: string;
    toTokenAddress: string;
    fromTokenSymbol: string;
    toTokenSymbol: string;
  }): IPriceAlertWithFavorite {
    return {
      id: alert.id,
      favoriteId: alert.favoriteId,
      userId: alert.userId,
      targetToAmount: alert.targetToAmount,
      status: alert.status as PriceAlertStatus,
      createdAt: alert.createdAt,
      updatedAt: alert.updatedAt,
      lastCheckedAt: alert.lastCheckedAt,
      triggeredAt: alert.triggeredAt,
      lastObservedNetToAmount: alert.lastObservedNetToAmount,
      lastObservedAggregator: alert.lastObservedAggregator,
      chain: alert.chain as ChainType,
      amount: alert.amount,
      fromTokenAddress: alert.fromTokenAddress,
      toTokenAddress: alert.toTokenAddress,
      fromTokenSymbol: alert.fromTokenSymbol,
      toTokenSymbol: alert.toTokenSymbol,
    };
  }
}
