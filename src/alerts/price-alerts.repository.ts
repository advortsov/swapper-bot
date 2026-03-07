import { Injectable } from '@nestjs/common';

import type { ChainType } from '../chains/interfaces/chain.interface';
import { DatabaseService } from '../database/database.service';
import type {
  AlertKind,
  ICreatePriceAlertInput,
  IPriceAlertRecord,
  IPriceAlertWithFavorite,
  PriceAlertStatus,
} from './interfaces/price-alert.interface';

type AlertDirection = 'up' | 'down' | 'cross' | null;

interface IPriceAlertDbRecord {
  id: string;
  favorite_id: string | null;
  user_id: string;
  target_to_amount: string | null;
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
}

interface IPriceAlertDbWithFavorite extends IPriceAlertDbRecord {
  chain: string;
  amount: string;
  from_token_address: string;
  to_token_address: string;
  from_token_symbol: string;
  to_token_symbol: string;
}

interface IAlertUpdateSet {
  target_to_amount: string | null;
  kind: string;
  updated_at: Date;
  last_checked_at: Date | null;
  triggered_at: Date | null;
  last_observed_net_to_amount: string | null;
  last_observed_aggregator: string | null;
  direction?: 'up' | 'down' | 'cross' | null;
  percentage_change?: number;
  repeatable?: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  watch_token_address?: string;
  watch_chain?: string;
}

interface IAlertInsertSet {
  favorite_id: string | null;
  user_id: string;
  target_to_amount: string | null;
  status: string;
  kind: string;
  direction: string | null;
  percentage_change: number | null;
  repeatable: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  watch_token_address: string | null;
  watch_chain: string | null;
}

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
      return this.updateExistingAlert(existing.id, input);
    }

    return this.insertNewAlert(input);
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
    const alert: IPriceAlertDbRecord | undefined = await this.databaseService
      .getConnection()
      .selectFrom('price_alerts')
      .selectAll()
      .where('favorite_id', '=', favoriteId)
      .where('status', '=', 'active')
      .executeTakeFirst();

    return alert ? this.mapRecord(alert) : null;
  }

  public async findActiveByAlertId(alertId: string): Promise<IPriceAlertRecord | null> {
    const alert: IPriceAlertDbRecord | undefined = await this.databaseService
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
        'price_alerts.id',
        'price_alerts.favorite_id',
        'price_alerts.user_id',
        'price_alerts.target_to_amount',
        'price_alerts.status',
        'price_alerts.created_at',
        'price_alerts.updated_at',
        'price_alerts.last_checked_at',
        'price_alerts.triggered_at',
        'price_alerts.last_observed_net_to_amount',
        'price_alerts.last_observed_aggregator',
        'price_alerts.kind',
        'price_alerts.direction',
        'price_alerts.percentage_change',
        'price_alerts.repeatable',
        'price_alerts.quiet_hours_start',
        'price_alerts.quiet_hours_end',
        'price_alerts.watch_token_address',
        'price_alerts.watch_chain',
        'favorite_pairs.chain',
        'favorite_pairs.amount',
        'favorite_pairs.from_token_address',
        'favorite_pairs.to_token_address',
        'from_token.symbol as from_token_symbol',
        'to_token.symbol as to_token_symbol',
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

  public async createRepeatableAlert(input: ICreatePriceAlertInput): Promise<IPriceAlertRecord> {
    return this.insertNewAlert(input);
  }

  private async updateExistingAlert(
    existingId: string,
    input: ICreatePriceAlertInput,
  ): Promise<IPriceAlertRecord> {
    const updateSet = this.buildUpdateSet(input);

    const updated: IPriceAlertDbRecord = await this.databaseService
      .getConnection()
      .updateTable('price_alerts')
      .set(updateSet)
      .where('id', '=', existingId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapRecord(updated);
  }

  private async insertNewAlert(input: ICreatePriceAlertInput): Promise<IPriceAlertRecord> {
    const insertSet = this.buildInsertSet(input);

    const created: IPriceAlertDbRecord = await this.databaseService
      .getConnection()
      .insertInto('price_alerts')
      .values(insertSet)
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapRecord(created);
  }

  private buildUpdateSet(input: ICreatePriceAlertInput): IAlertUpdateSet {
    const updateSet: IAlertUpdateSet = {
      target_to_amount: input.targetToAmount,
      kind: input.kind,
      updated_at: new Date(),
      last_checked_at: null,
      triggered_at: null,
      last_observed_net_to_amount: null,
      last_observed_aggregator: null,
    };

    if (input.direction !== undefined) {
      updateSet.direction = input.direction;
    }
    if (input.percentageChange !== undefined) {
      updateSet.percentage_change = input.percentageChange;
    }
    if (input.repeatable !== undefined) {
      updateSet.repeatable = input.repeatable;
    }
    if (input.quietHoursStart !== undefined) {
      updateSet.quiet_hours_start = input.quietHoursStart;
    }
    if (input.quietHoursEnd !== undefined) {
      updateSet.quiet_hours_end = input.quietHoursEnd;
    }
    if (input.watchTokenAddress !== undefined) {
      updateSet.watch_token_address = input.watchTokenAddress;
    }
    if (input.watchChain !== undefined) {
      updateSet.watch_chain = input.watchChain;
    }

    return updateSet;
  }

  private buildInsertSet(input: ICreatePriceAlertInput): IAlertInsertSet {
    const insertSet: IAlertInsertSet = {
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

    return insertSet;
  }

  private mapRecord(record: IPriceAlertDbRecord): IPriceAlertRecord {
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
      kind: record.kind as AlertKind,
      direction: record.direction as AlertDirection,
      percentageChange: record.percentage_change,
      repeatable: record.repeatable,
      quietHoursStart: record.quiet_hours_start,
      quietHoursEnd: record.quiet_hours_end,
      watchTokenAddress: record.watch_token_address,
      watchChain: record.watch_chain as ChainType | null,
    };
  }

  private mapAlertWithFavorite(alert: IPriceAlertDbWithFavorite): IPriceAlertWithFavorite {
    return {
      id: alert.id,
      favoriteId: alert.favorite_id,
      userId: alert.user_id,
      targetToAmount: alert.target_to_amount,
      status: alert.status as PriceAlertStatus,
      createdAt: alert.created_at,
      updatedAt: alert.updated_at,
      lastCheckedAt: alert.last_checked_at,
      triggeredAt: alert.triggered_at,
      lastObservedNetToAmount: alert.last_observed_net_to_amount,
      lastObservedAggregator: alert.last_observed_aggregator,
      kind: alert.kind as AlertKind,
      direction: alert.direction as AlertDirection,
      percentageChange: alert.percentage_change,
      repeatable: alert.repeatable,
      quietHoursStart: alert.quiet_hours_start,
      quietHoursEnd: alert.quiet_hours_end,
      watchTokenAddress: alert.watch_token_address,
      watchChain: alert.watch_chain as ChainType | null,
      chain: alert.chain as ChainType,
      amount: alert.amount,
      fromTokenAddress: alert.from_token_address,
      toTokenAddress: alert.to_token_address,
      fromTokenSymbol: alert.from_token_symbol,
      toTokenSymbol: alert.to_token_symbol,
    };
  }
}
