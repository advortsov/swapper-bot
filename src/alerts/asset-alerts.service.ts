import { Injectable } from '@nestjs/common';

import type { ChainType } from '../chains/interfaces/chain.interface';
import { DatabaseService } from '../database/database.service';
import type { IDatabase } from '../database/database.types';
import { FavoritePairsRepository } from '../favorites/favorite-pairs.repository';
import { TokensRepository } from '../tokens/tokens.repository';
import type { IPriceAlertRecord } from './interfaces/price-alert.interface';
import type { IPriceAlertWithToken } from './interfaces/token-info.interface';

const PERCENTAGE_MULTIPLIER = 100;

type AlertDirection = 'up' | 'down' | 'cross' | null;

@Injectable()
export class AssetAlertsService {
  public constructor(
    private readonly databaseService: DatabaseService,
    private readonly tokensRepository: TokensRepository,
    private readonly favoritesRepository: FavoritePairsRepository,
  ) {}

  public async createAssetAlert(input: {
    userId: string;
    tokenAddress: string;
    chain: ChainType;
    direction?: 'up' | 'down' | 'cross';
    percentageChange?: number;
    repeatable?: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
  }): Promise<IPriceAlertRecord> {
    const tokenInfo = await this.tokensRepository.findByAddressAndChain(
      input.tokenAddress,
      input.chain,
    );

    if (!tokenInfo) {
      throw new Error('Token not found');
    }

    const insertValues: {
      user_id: string;
      favorite_id: string | null;
      target_to_amount: string | null;
      status: string;
      kind: string;
      direction: string | null;
      percentage_change: number | null;
      repeatable: boolean;
      quiet_hours_start: string | null;
      quiet_hours_end: string | null;
      watch_token_address: string;
      watch_chain: string;
    } = {
      user_id: input.userId,
      favorite_id: null,
      target_to_amount: null,
      status: 'active',
      kind: 'asset',
      direction: input.direction ?? null,
      percentage_change: input.percentageChange ?? null,
      repeatable: input.repeatable ?? false,
      quiet_hours_start: input.quietHoursStart ?? null,
      quiet_hours_end: input.quietHoursEnd ?? null,
      watch_token_address: input.tokenAddress,
      watch_chain: input.chain,
    };

    const result = await this.databaseService
      .getConnection()
      .insertInto('price_alerts')
      .values(insertValues as any)
      .returning([
        'id',
        'user_id as userId',
        'favorite_id as favoriteId',
        'target_to_amount as targetToAmount',
        'status as status',
        'created_at as createdAt',
        'updated_at as updatedAt',
        'last_checked_at as lastCheckedAt',
        'triggered_at as triggeredAt',
        'last_observed_net_to_amount as lastObservedNetToAmount',
        'last_observed_aggregator as lastObservedAggregator',
        'kind as kind',
        'direction as direction',
        'percentage_change as percentageChange',
        'repeatable as repeatable',
        'quiet_hours_start as quietHoursStart',
        'quiet_hours_end as quietHoursEnd',
        'watch_token_address as watchTokenAddress',
        'watch_chain as watchChain',
      ])
      .executeTakeFirstOrThrow();

    return this.mapAssetRecord(result as any);
  }

  public async listActiveAssetAlerts(limit: number): Promise<readonly IPriceAlertWithToken[]> {
    const alerts = await this.databaseService
      .getConnection()
      .selectFrom('price_alerts')
      .innerJoin('tokens', (join) =>
        join.onRef('tokens.address', '=', 'price_alerts.watch_token_address'),
      )
      .select([
        'price_alerts.id as id',
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
        'tokens.symbol as symbol',
        'tokens.decimals as decimals',
        'tokens.address as tokenAddress',
        'tokens.chain as chain',
      ])
      .where('price_alerts.kind', '=', 'asset')
      .where('price_alerts.status', '=', 'active')
      .orderBy('price_alerts.updated_at', 'asc')
      .limit(limit)
      .execute();

    return alerts.map((alert) => this.mapAssetWithToken(alert as any));
  }

  public async updateAssetAlert(
    alertId: string,
    input: {
      netToAmount?: string;
      aggregator?: string | null;
    },
  ): Promise<void> {
    const updateValues: Partial<Record<keyof IDatabase['price_alerts'], unknown>> = {
      updated_at: new Date(),
      last_checked_at: new Date(),
    };

    if (input.netToAmount !== undefined) {
      updateValues.last_observed_net_to_amount = input.netToAmount;
    }
    if (input.aggregator !== undefined) {
      updateValues.last_observed_aggregator = input.aggregator;
    }

    await this.databaseService
      .getConnection()
      .updateTable('price_alerts')
      .set(updateValues as any)
      .where('id', '=', alertId)
      .execute();
  }

  public async markAssetAlertTriggered(
    alertId: string,
    input: {
      netToAmount: string;
      aggregator: string | null;
    },
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

  private mapAssetRecord(record: {
    id: string;
    favoriteId: string | null;
    userId: string;
    targetToAmount: string | null;
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
  }): IPriceAlertRecord {
    return {
      id: record.id,
      favoriteId: record.favoriteId,
      userId: record.userId,
      targetToAmount: record.targetToAmount,
      status: record.status as any,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      lastCheckedAt: record.lastCheckedAt,
      triggeredAt: record.triggeredAt,
      lastObservedNetToAmount: record.lastObservedNetToAmount,
      lastObservedAggregator: record.lastObservedAggregator,
      kind: record.kind as any,
      direction: record.direction as AlertDirection,
      percentageChange: record.percentageChange,
      repeatable: record.repeatable,
      quietHoursStart: record.quietHoursStart,
      quietHoursEnd: record.quietHoursEnd,
      watchTokenAddress: record.watchTokenAddress,
      watchChain: record.watchChain as any,
    };
  }

  private mapAssetWithToken(alert: {
    id: string;
    userId: string;
    targetToAmount: string | null;
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
    watchTokenAddress: string;
    watchChain: string | null;
    symbol: string;
    decimals: number;
    tokenAddress: string;
    chain: string;
  }): IPriceAlertWithToken {
    return {
      id: alert.id,
      userId: alert.userId,
      status: alert.status,
      targetToAmount: alert.targetToAmount,
      kind: alert.kind,
      direction: alert.direction,
      percentageChange: alert.percentageChange,
      repeatable: alert.repeatable,
      quietHoursStart: alert.quietHoursStart,
      quietHoursEnd: alert.quietHoursEnd,
      symbol: alert.symbol,
      decimals: alert.decimals,
      tokenAddress: alert.tokenAddress,
      chain: alert.chain,
    };
  }

  public isInQuietHours(quietHoursStart: string | null, quietHoursEnd: string | null): boolean {
    if (!quietHoursStart || !quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const startParts = quietHoursStart.split(':');
    const endParts = quietHoursEnd.split(':');

    if (startParts.length !== 2 || endParts.length !== 2) {
      return false;
    }

    const startHour = Number.parseInt(startParts[0] ?? '0', 10);
    const endHour = Number.parseInt(endParts[0] ?? '0', 10);
    const startMin = Number.parseInt(startParts[1] ?? '0', 10);
    const endMin = Number.parseInt(endParts[1] ?? '0', 10);

    if (currentHour < startHour || currentHour > endHour) {
      return false;
    }

    if (currentHour === startHour && currentHour === endHour) {
      if (startMin > endMin) {
        return false;
      }

      return true;
    }

    return false;
  }

  public shouldTriggerDirection(
    alert: Pick<IPriceAlertRecord, 'direction' | 'lastObservedNetToAmount'>,
    currentPrice: string,
  ): boolean {
    if (alert.direction === null) {
      return false;
    }

    const lastPrice = alert.lastObservedNetToAmount
      ? Number.parseFloat(alert.lastObservedNetToAmount)
      : null;

    const current = Number.parseFloat(currentPrice);

    if (lastPrice === null) {
      return false;
    }

    if (alert.direction === 'up' && current >= lastPrice) {
      return true;
    }

    if (alert.direction === 'down' && current <= lastPrice) {
      return true;
    }

    if (alert.direction === 'cross') {
      if (lastPrice < current) {
        return current >= lastPrice;
      }

      return current <= lastPrice;
    }

    return false;
  }

  public shouldTriggerPercentage(
    alert: Pick<IPriceAlertRecord, 'lastObservedNetToAmount' | 'percentageChange'>,
    currentPrice: string,
  ): boolean {
    if (alert.percentageChange === null) {
      return false;
    }

    const lastPrice = alert.lastObservedNetToAmount
      ? Number.parseFloat(alert.lastObservedNetToAmount)
      : null;

    const current = Number.parseFloat(currentPrice);
    const percentage = alert.percentageChange;

    if (lastPrice === null) {
      return false;
    }

    const change = Math.abs(current - lastPrice) / lastPrice;

    return change >= percentage / PERCENTAGE_MULTIPLIER;
  }

  public async countActiveAssetAlertsByUser(userId: string): Promise<number> {
    const result = await this.databaseService
      .getConnection()
      .selectFrom('price_alerts')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('user_id', '=', userId)
      .where('kind', '=', 'asset')
      .where('status', '=', 'active')
      .executeTakeFirstOrThrow();

    return Number(result.count);
  }
}
