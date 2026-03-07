import { Injectable } from '@nestjs/common';

import type { ChainType } from '../chains/interfaces/chain.interface';
import { DatabaseService } from '../database/database.service';
import type { IDatabase } from '../database/database.types';
import type {
  ICreatePriceAlertInput,
  IPriceAlertRecord,
  IPriceAlertWithFavorite,
  PriceAlertStatus,
} from './interfaces/price-alert.interface';

type AlertDirection = 'up' | 'down' | 'cross' | null;

@Injectable()
export class PriceAlertsRepository {
  public constructor(private readonly databaseService: DatabaseService) {}

  public async upsertActiveAlert(input: ICreatePriceAlertInput): Promise<IPriceAlertRecord> {
    const existing = await this.databaseService
      .getConnection()
      .selectFrom('price_alerts')
      .select(['id'])
      .where('favorite_id', '=', input.favoriteId ?? '')
      .where('status', '=', 'active')
      .executeTakeFirst();

    if (existing) {
      const updateValues: Partial<Record<keyof IDatabase['price_alerts'], unknown>> = {
        target_to_amount: input.targetToAmount,
        kind: input.kind,
        updated_at: new Date(),
        last_checked_at: null,
        triggered_at: null,
        last_observed_net_to_amount: null,
        last_observed_aggregator: null,
      };

      if (input.direction !== undefined) {
        updateValues.direction = input.direction;
      }
      if (input.percentageChange !== undefined) {
        updateValues.percentage_change = input.percentageChange;
      }
      if (input.repeatable !== undefined) {
        updateValues.repeatable = input.repeatable;
      }
      if (input.quietHoursStart !== undefined) {
        updateValues.quiet_hours_start = input.quietHoursStart;
      }
      if (input.quietHoursEnd !== undefined) {
        updateValues.quiet_hours_end = input.quietHoursEnd;
      }
      if (input.watchTokenAddress !== undefined) {
        updateValues.watch_token_address = input.watchTokenAddress;
      }
      if (input.watchChain !== undefined) {
        updateValues.watch_chain = input.watchChain;
      }

      const updated = await this.databaseService
        .getConnection()
        .updateTable('price_alerts')
        .set(updateValues as any)
        .where('id', '=', existing.id)
        .returningAll()
        .executeTakeFirstOrThrow();

      return this.mapRecord(updated);
    }

    const insertValues = {
      favorite_id: input.favoriteId ?? null,
      user_id: input.userId,
      target_to_amount: input.targetToAmount ?? null,
      status: 'active',
      kind: input.kind,
      direction: input.direction ?? null,
      percentage_change: input.percentageChange ?? null,
      repeatable: input.repeatable ?? false,
      quiet_hours_start: input.quietHoursStart ?? null,
      quiet_hours_end: input.quietHoursEnd ?? null,
      watch_token_address: input.watchTokenAddress ?? null,
      watch_chain: input.watchChain ?? null,
    };

    const created = await this.databaseService
      .getConnection()
      .insertInto('price_alerts')
      .values(insertValues as any)
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

  public async findActiveByAlertId(alertId: string): Promise<IPriceAlertRecord | null> {
    const alert = await this.databaseService
      .getConnection()
      .selectFrom('price_alerts')
      .selectAll()
      .where('id', '=', alertId)
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
        'price_alerts.kind as kind',
        'price_alerts.direction as direction',
        'price_alerts.percentage_change as percentageChange',
        'price_alerts.repeatable as repeatable',
        'price_alerts.quiet_hours_start as quietHoursStart',
        'price_alerts.quiet_hours_end as quietHoursEnd',
        'price_alerts.watch_token_address as watchTokenAddress',
        'price_alerts.watch_chain as watchChain',
        'favorite_pairs.chain as chain',
        'favorite_pairs.amount as amount',
        'favorite_pairs.from_token_address as fromTokenAddress',
        'favorite_pairs.to_token_address as toTokenAddress',
        'from_token.symbol as fromTokenSymbol',
        'to_token.symbol as toTokenSymbol',
      ])
      .where('price_alerts.status', '=', 'active')
      .where('price_alerts.favorite_id', 'is not', null)
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
      } as any)
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
      } as any)
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
      } as any)
      .where('id', '=', alertId)
      .where('user_id', '=', userId)
      .where('status', '=', 'active')
      .executeTakeFirst();

    return Number(result.numUpdatedRows) > 0;
  }

  public async createRepeatableAlert(input: ICreatePriceAlertInput): Promise<IPriceAlertRecord> {
    const insertValues = {
      favorite_id: input.favoriteId ?? null,
      user_id: input.userId,
      target_to_amount: input.targetToAmount ?? null,
      status: 'active',
      kind: input.kind,
      direction: input.direction ?? null,
      percentage_change: input.percentageChange ?? null,
      repeatable: input.repeatable ?? false,
      quiet_hours_start: input.quietHoursStart ?? null,
      quiet_hours_end: input.quietHoursEnd ?? null,
      watch_token_address: input.watchTokenAddress ?? null,
      watch_chain: input.watchChain ?? null,
    };

    const created = await this.databaseService
      .getConnection()
      .insertInto('price_alerts')
      .values(insertValues as any)
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapRecord(created);
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
    kind: string;
    direction: string | null;
    percentage_change: number | null;
    repeatable: boolean;
    quiet_hours_start: string | null;
    quiet_hours_end: string | null;
    watch_token_address: string | null;
    watch_chain: string | null;
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
      kind: record.kind as any,
      direction: record.direction as AlertDirection,
      percentageChange: record.percentage_change,
      repeatable: record.repeatable,
      quietHoursStart: record.quiet_hours_start,
      quietHoursEnd: record.quiet_hours_end,
      watchTokenAddress: record.watch_token_address,
      watchChain: record.watch_chain as any,
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
    kind: string;
    direction: string | null;
    percentageChange: number | null;
    repeatable: boolean;
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
    watchTokenAddress: string | null;
    watchChain: string | null;
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
      kind: alert.kind as any,
      direction: alert.direction as AlertDirection,
      percentageChange: alert.percentageChange,
      repeatable: alert.repeatable,
      quietHoursStart: alert.quietHoursStart,
      quietHoursEnd: alert.quietHoursEnd,
      watchTokenAddress: alert.watchTokenAddress,
      watchChain: alert.watchChain as any,
      chain: alert.chain as ChainType,
      amount: alert.amount,
      fromTokenAddress: alert.fromTokenAddress,
      toTokenAddress: alert.toTokenAddress,
      fromTokenSymbol: alert.fromTokenSymbol,
      toTokenSymbol: alert.toTokenSymbol,
    };
  }
}
