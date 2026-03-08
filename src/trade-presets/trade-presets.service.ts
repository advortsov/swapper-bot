import { Injectable } from '@nestjs/common';

import type { ICreatePresetInput, ITradePresetView } from './interfaces/trade-preset.interface';
import { BusinessException } from '../common/exceptions/business.exception';
import { TradePresetsRepository } from '../database/repositories/trade-presets.repository';

const DEFAULT_MAX_PRESETS = 10;

@Injectable()
export class TradePresetsService {
  private readonly maxPresets: number;

  public constructor(private readonly tradePresetsRepository: TradePresetsRepository) {
    this.maxPresets = DEFAULT_MAX_PRESETS;
  }

  public async createPreset(input: ICreatePresetInput): Promise<ITradePresetView> {
    const existing = await this.tradePresetsRepository.findByLabel(input.userId, input.label);

    if (existing) {
      throw new BusinessException('Пресет с таким названием уже существует');
    }

    const currentCount = await this.tradePresetsRepository.listByUser(input.userId);

    if (currentCount.length >= this.maxPresets) {
      throw new BusinessException(`Превышен лимит пресетов (${this.maxPresets})`);
    }

    const created = await this.tradePresetsRepository.create(input);

    const preset = await this.tradePresetsRepository.findById(created.id, input.userId);

    if (!preset) {
      throw new BusinessException('Не удалось создать пресет');
    }

    return preset;
  }

  public async listPresets(userId: string): Promise<readonly ITradePresetView[]> {
    return this.tradePresetsRepository.listByUser(userId);
  }

  public async getPreset(userId: string, presetId: string): Promise<ITradePresetView | null> {
    return this.tradePresetsRepository.findById(presetId, userId);
  }

  public async deletePreset(userId: string, presetId: string): Promise<boolean> {
    return this.tradePresetsRepository.delete(presetId, userId);
  }
}
