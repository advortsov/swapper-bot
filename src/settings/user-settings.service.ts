import { Injectable } from '@nestjs/common';

import {
  type IUserSettings,
  DEFAULT_USER_SETTINGS,
  isKnownAggregator,
  isValidSlippage,
  parseUserSettings,
} from './interfaces/user-settings.interface';
import { BusinessException } from '../common/exceptions/business.exception';
import { UsersRepository } from '../database/repositories/users.repository';

@Injectable()
export class UserSettingsService {
  public constructor(private readonly usersRepository: UsersRepository) {}

  public async getSettings(userId: string): Promise<IUserSettings> {
    const raw: Record<string, unknown> | null = await this.usersRepository.getSettings(userId);

    return parseUserSettings(raw);
  }

  public async updateSlippage(userId: string, value: number): Promise<IUserSettings> {
    if (!isValidSlippage(value)) {
      throw new BusinessException('Slippage должен быть от 0.01% до 50%');
    }

    const current = await this.getSettings(userId);
    const updated: IUserSettings = { ...current, slippage: value };

    await this.persistSettings(userId, updated);

    return updated;
  }

  public async updatePreferredAggregator(
    userId: string,
    aggregatorName: string,
  ): Promise<IUserSettings> {
    if (!isKnownAggregator(aggregatorName)) {
      throw new BusinessException(`Агрегатор ${aggregatorName} не поддерживается`);
    }

    const current = await this.getSettings(userId);
    const updated: IUserSettings = { ...current, preferredAggregator: aggregatorName };

    await this.persistSettings(userId, updated);

    return updated;
  }

  public getDefaults(): IUserSettings {
    return { ...DEFAULT_USER_SETTINGS };
  }

  private async persistSettings(userId: string, settings: IUserSettings): Promise<void> {
    const payload: Record<string, unknown> = {
      slippage: settings.slippage,
      preferredAggregator: settings.preferredAggregator,
    };

    await this.usersRepository.updateSettings(userId, payload);
  }
}
