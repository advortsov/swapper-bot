import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PriceAlertsRepository } from './price-alerts.repository';
import { BusinessException } from '../common/exceptions/business.exception';
import { FavoritesService } from '../favorites/favorites.service';
import type {
  IPriceAlertRecord,
  IPriceAlertWithFavorite,
} from './interfaces/price-alert.interface';
import type { IFavoritePairView } from '../favorites/interfaces/favorite-pair.interface';

const DEFAULT_MAX_ACTIVE_ALERTS = 20;
const MIN_ACTIVE_ALERTS = 1;

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
    });
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
    const target = Number.parseFloat(alert.targetToAmount);
    const current = Number.parseFloat(currentNetToAmount);

    if (![previous, target, current].every((value) => Number.isFinite(value))) {
      return false;
    }

    const crossedUp = previous < target && current >= target;
    const crossedDown = previous > target && current <= target;

    return crossedUp || crossedDown;
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
