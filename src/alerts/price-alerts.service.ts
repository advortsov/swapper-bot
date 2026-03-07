import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PriceAlertsRepository } from './price-alerts.repository';
import { BusinessException } from '../common/exceptions/business.exception';
import { FavoritesService } from '../favorites/favorites.service';
import type {
  ICreatePriceAlertInput,
  IPriceAlertRecord,
  IPriceAlertWithFavorite,
} from './interfaces/price-alert.interface';
import type { IFavoritePairView } from '../favorites/interfaces/favorite-pair.interface';

const DEFAULT_MAX_ACTIVE_ALERTS = 20;
const MIN_ACTIVE_ALERTS = 1;
const PERCENTAGE_MULTIPLIER = 100;

@Injectable()
export class PriceAlertsService {
  private readonly maxActiveAlerts: number;

  public constructor(
    private readonly configService: ConfigService,
    private readonly priceAlertsRepository: PriceAlertsRepository,
    private readonly favoritesService: FavoritesService,
  ) {
    this.maxActiveAlerts = this.resolveMaxActiveAlerts();
  }

  public async upsertAlert(
    userId: string,
    favoriteId: string,
    targetToAmount: string,
  ): Promise<IPriceAlertRecord> {
    const favorite = await this.getFavoriteOrThrow(userId, favoriteId);
    const normalizedTarget = this.normalizeTarget(targetToAmount);
    const existing = await this.priceAlertsRepository.findActiveByFavorite(favorite.id);

    if (!existing) {
      const activeCount = await this.priceAlertsRepository.countActiveByUser(userId);

      if (activeCount >= this.maxActiveAlerts) {
        throw new BusinessException(`Превышен лимит активных алертов (${this.maxActiveAlerts})`);
      }
    }

    return this.priceAlertsRepository.upsertActiveAlert({
      favoriteId: favorite.id,
      userId,
      targetToAmount: normalizedTarget,
      kind: 'fixed',
      direction: null,
      repeatable: false,
    });
  }

  public async upsertAdvancedAlert(input: ICreatePriceAlertInput): Promise<IPriceAlertRecord> {
    const existing = await this.priceAlertsRepository.findActiveByAlertId(input.userId);

    if (input.favoriteId && !existing) {
      const activeCount = await this.priceAlertsRepository.countActiveByUser(input.userId);

      if (activeCount >= this.maxActiveAlerts) {
        throw new BusinessException(`Превышен лимит активных алертов (${this.maxActiveAlerts})`);
      }
    }

    return this.priceAlertsRepository.upsertActiveAlert(input);
  }

  public async cancelAlert(userId: string, favoriteId: string): Promise<boolean> {
    const existing = await this.priceAlertsRepository.findActiveByFavorite(favoriteId);

    if (!existing) {
      return false;
    }

    return this.priceAlertsRepository.cancel(existing.id, userId);
  }

  public async getActiveAlertForFavorite(favoriteId: string): Promise<IPriceAlertRecord | null> {
    return this.priceAlertsRepository.findActiveByFavorite(favoriteId);
  }

  public async listActiveBatch(limit: number): Promise<readonly IPriceAlertWithFavorite[]> {
    return this.priceAlertsRepository.listActiveBatch(limit);
  }

  public async markObserved(
    alertId: string,
    netToAmount: string,
    aggregator: string | null,
  ): Promise<void> {
    await this.priceAlertsRepository.markObserved(alertId, { netToAmount, aggregator });
  }

  public async markTriggered(
    alertId: string,
    netToAmount: string,
    aggregator: string | null,
  ): Promise<void> {
    await this.priceAlertsRepository.markTriggered(alertId, { netToAmount, aggregator });
  }

  public shouldTriggerOnCrossing(
    alert: Pick<IPriceAlertRecord, 'targetToAmount' | 'lastObservedNetToAmount'>,
    currentNetToAmount: string,
  ): boolean {
    if (alert.lastObservedNetToAmount === null) {
      return false;
    }

    const previous = Number.parseFloat(alert.lastObservedNetToAmount);
    const target = Number.parseFloat(alert.targetToAmount ?? '0');
    const current = Number.parseFloat(currentNetToAmount);

    if (![previous, target, current].every((value) => Number.isFinite(value))) {
      return false;
    }

    const crossedUp = previous < target && current >= target;
    const crossedDown = previous > target && current <= target;

    return crossedUp || crossedDown;
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

  public async resetRepeatableAlert(alertId: string): Promise<IPriceAlertRecord | null> {
    const existing = await this.priceAlertsRepository.findActiveByAlertId(alertId);

    if (!existing) {
      return null;
    }

    const input: ICreatePriceAlertInput = {
      favoriteId: existing.favoriteId,
      userId: existing.userId,
      targetToAmount: existing.targetToAmount,
      kind: existing.kind,
      repeatable: existing.repeatable,
    };

    if (existing.direction) {
      input.direction = existing.direction;
    }
    if (existing.percentageChange !== null) {
      input.percentageChange = existing.percentageChange;
    }
    if (existing.quietHoursStart) {
      input.quietHoursStart = existing.quietHoursStart;
    }
    if (existing.quietHoursEnd) {
      input.quietHoursEnd = existing.quietHoursEnd;
    }
    if (existing.watchTokenAddress) {
      input.watchTokenAddress = existing.watchTokenAddress;
    }
    if (existing.watchChain) {
      input.watchChain = existing.watchChain;
    }

    return this.priceAlertsRepository.createRepeatableAlert(input);
  }

  private async getFavoriteOrThrow(userId: string, favoriteId: string): Promise<IFavoritePairView> {
    const favorite = await this.favoritesService.getFavorite(userId, favoriteId);

    if (!favorite) {
      throw new BusinessException('Избранная пара не найдена');
    }

    return favorite;
  }

  private normalizeTarget(value: string): string {
    const normalized = value.replace(',', '.').trim();
    const parsed = Number.parseFloat(normalized);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BusinessException('Порог алерта должен быть положительным числом');
    }

    return normalized;
  }

  private resolveMaxActiveAlerts(): number {
    const rawValue = this.configService.get<string>('MAX_ACTIVE_PRICE_ALERTS_PER_USER');
    const parsed = Number.parseInt(rawValue ?? `${DEFAULT_MAX_ACTIVE_ALERTS}`, 10);

    if (!Number.isInteger(parsed) || parsed < MIN_ACTIVE_ALERTS) {
      return DEFAULT_MAX_ACTIVE_ALERTS;
    }

    return parsed;
  }
}
