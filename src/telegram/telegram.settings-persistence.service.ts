import { Injectable } from '@nestjs/common';

import { MAX_CUSTOM_SLIPPAGE, MIN_CUSTOM_SLIPPAGE } from './telegram.settings-menu.service';
import { BusinessException } from '../common/exceptions/business.exception';
import type { IUserSettings } from '../settings/interfaces/user-settings.interface';
import { UserSettingsService } from '../settings/user-settings.service';

@Injectable()
export class TelegramSettingsPersistenceService {
  public constructor(private readonly userSettingsService: UserSettingsService) {}

  public getSettings(userId: string): Promise<IUserSettings> {
    return this.userSettingsService.getSettings(userId);
  }

  public updateSlippage(userId: string, value: number): Promise<IUserSettings> {
    return this.userSettingsService.updateSlippage(userId, value);
  }

  public updatePreferredAggregator(userId: string, aggregatorName: string): Promise<IUserSettings> {
    return this.userSettingsService.updatePreferredAggregator(userId, aggregatorName);
  }

  public parseCustomSlippage(text: string): number {
    const value = Number.parseFloat(text.replace(',', '.'));

    if (!Number.isFinite(value) || value < MIN_CUSTOM_SLIPPAGE || value > MAX_CUSTOM_SLIPPAGE) {
      throw new BusinessException(
        `Некорректное значение. Slippage должен быть от ${MIN_CUSTOM_SLIPPAGE}% до ${MAX_CUSTOM_SLIPPAGE}%.`,
      );
    }

    return value;
  }
}
