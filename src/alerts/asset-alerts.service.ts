import { Injectable } from '@nestjs/common';

import type { ChainType } from '../chains/interfaces/chain.interface';
import { DatabaseService } from '../database/database.service';
import { FavoritePairsRepository } from '../favorites/favorite-pairs.repository';
import { TokensRepository } from '../tokens/tokens.repository';
import type {
  IPriceAlertRecord,
  PriceAlertStatus,
  AlertKind,
} from './interfaces/price-alert.interface';
import type { IPriceAlertWithToken } from './interfaces/token-info.interface';

const PERCENTAGE_MULTIPLIER = 100;

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

interface IPriceAlertDbWithToken extends IPriceAlertDbRecord {
  symbol: string;
  decimals: number;
  token_address: string;
  chain: string;
}

interface IAssetAlertInsertSet {
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
}

interface IAssetAlertUpdateSet {
  updated_at: Date;
  last_checked_at: Date;
  last_observed_net_to_amount?: string;
  last_observed_aggregator?: string | null;
}

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

    const insertSet: IAssetAlertInsertSet = {
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

    const result: IPriceAlertDbRecord = await this.databaseService
      .getConnection()
      .insertInto('price_alerts')
      .values(insertSet)
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapAssetRecord(result);
  }

  public async listActiveAssetAlerts(limit: number): Promise<readonly IPriceAlertWithToken[]> {
    const alerts = await this.databaseService
      .getConnection()
      .selectFrom('price_alerts')
      .innerJoin('tokens', (join) =>
        join.onRef('tokens.address', '=', 'price_alerts.watch_token_address'),
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
        'tokens.symbol',
        'tokens.decimals',
        'tokens.address as token_address',
        'tokens.chain',
      ])
      .where('price_alerts.kind', '=', 'asset')
      .where('price_alerts.status', '=', 'active')
      .orderBy('price_alerts.updated_at', 'asc')
      .limit(limit)
      .execute();

    const typedAlerts: readonly IPriceAlertDbWithToken[] = alerts;
    return typedAlerts.map((alert) => this.mapAssetWithToken(alert));
  }

  public async updateAssetAlert(
    alertId: string,
    input: {
      netToAmount?: string;
      aggregator?: string | null;
    },
  ): Promise<void> {
    const updateSet: IAssetAlertUpdateSet = {
      updated_at: new Date(),
      last_checked_at: new Date(),
    };

    if (input.netToAmount !== undefined) {
      updateSet.last_observed_net_to_amount = input.netToAmount;
    }
    if (input.aggregator !== undefined) {
      updateSet.last_observed_aggregator = input.aggregator;
    }

    await this.databaseService
      .getConnection()
      .updateTable('price_alerts')
      .set(updateSet)
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
      })
      .where('id', '=', alertId)
      .execute();
  }

  private mapAssetRecord(record: IPriceAlertDbRecord): IPriceAlertRecord {
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

  private mapAssetWithToken(alert: IPriceAlertDbWithToken): IPriceAlertWithToken {
    return {
      id: alert.id,
      userId: alert.user_id,
      status: alert.status,
      targetToAmount: alert.target_to_amount,
      kind: alert.kind,
      direction: alert.direction,
      percentageChange: alert.percentage_change,
      repeatable: alert.repeatable,
      quietHoursStart: alert.quiet_hours_start,
      quietHoursEnd: alert.quiet_hours_end,
      symbol: alert.symbol,
      decimals: alert.decimals,
      tokenAddress: alert.token_address,
      chain: alert.chain,
    };
  }

  public isInQuietHours(quietHoursStart: string | null, quietHoursEnd: string | null): boolean {
    if (!quietHoursStart || !quietHoursEnd) {
      return false;
    }

    const start = this.parseTimeParts(quietHoursStart);
    const end = this.parseTimeParts(quietHoursEnd);

    if (!start || !end) {
      return false;
    }

    const currentHour = new Date().getHours();

    return this.isHourInRange(currentHour, start, end);
  }

  private parseTimeParts(time: string): { hour: number; minute: number } | null {
    const parts = time.split(':');
    const EXPECTED_PARTS = 2;

    if (parts.length !== EXPECTED_PARTS) {
      return null;
    }

    return {
      hour: Number.parseInt(parts[0] ?? '0', 10),
      minute: Number.parseInt(parts[1] ?? '0', 10),
    };
  }

  private isHourInRange(
    currentHour: number,
    start: { hour: number; minute: number },
    end: { hour: number; minute: number },
  ): boolean {
    if (currentHour < start.hour || currentHour > end.hour) {
      return false;
    }

    if (currentHour === start.hour && currentHour === end.hour) {
      return start.minute <= end.minute;
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
