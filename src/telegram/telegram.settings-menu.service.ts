import { Injectable } from '@nestjs/common';
import type { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram';

import {
  buildAggregatorMenuMessage,
  buildSettingsMenuMessage,
  buildSlippageMenuMessage,
} from './telegram.message-formatters';
import type { IUserSettings } from '../settings/interfaces/user-settings.interface';

export const SLIPPAGE_PRESET_LOW = 0.1;
export const SLIPPAGE_PRESET_DEFAULT = 0.5;
export const SLIPPAGE_PRESET_MEDIUM = 1;
export const SLIPPAGE_PRESET_HIGH = 3;
export const SLIPPAGE_PRESETS = [
  SLIPPAGE_PRESET_LOW,
  SLIPPAGE_PRESET_DEFAULT,
  SLIPPAGE_PRESET_MEDIUM,
  SLIPPAGE_PRESET_HIGH,
] as const;
export const MIN_CUSTOM_SLIPPAGE = 0.01;
export const MAX_CUSTOM_SLIPPAGE = 50;

export const AGGREGATOR_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'auto', label: 'Авто (лучшая цена)' },
  { value: 'paraswap', label: 'ParaSwap' },
  { value: 'zerox', label: '0x' },
  { value: 'odos', label: 'Odos' },
  { value: 'jupiter', label: 'Jupiter (Solana)' },
];

@Injectable()
export class TelegramSettingsMenuService {
  public buildMainMenuText(settings: IUserSettings): string {
    return buildSettingsMenuMessage(
      `${settings.slippage}`,
      this.getAggregatorLabel(settings.preferredAggregator),
    );
  }

  public buildMainMenuKeyboard(): InlineKeyboardButton[][] {
    return [
      [
        { text: 'Slippage', callback_data: 's:slip:menu' },
        { text: 'Агрегатор', callback_data: 's:agg:menu' },
      ],
    ];
  }

  public buildSlippageMenu(): {
    text: string;
    inlineKeyboard: InlineKeyboardButton[][];
  } {
    const presetButtons: InlineKeyboardButton[] = SLIPPAGE_PRESETS.map((value) => ({
      text: `${value}%`,
      callback_data: `s:slip:${value}`,
    }));

    return {
      text: buildSlippageMenuMessage(),
      inlineKeyboard: [
        presetButtons,
        [{ text: 'Ввести вручную', callback_data: 's:slip:custom' }],
        [{ text: 'Назад', callback_data: 's:menu' }],
      ],
    };
  }

  public buildAggregatorMenu(settings: IUserSettings): {
    text: string;
    inlineKeyboard: InlineKeyboardButton[][];
  } {
    const buttons: InlineKeyboardButton[][] = AGGREGATOR_OPTIONS.map((option) => {
      const prefix = settings.preferredAggregator === option.value ? '\u2705 ' : '';

      return [
        {
          text: `${prefix}${option.label}`,
          callback_data: `s:agg:${option.value}`,
        },
      ];
    });

    buttons.push([{ text: 'Назад', callback_data: 's:menu' }]);

    return {
      text: buildAggregatorMenuMessage(),
      inlineKeyboard: buttons,
    };
  }

  public getAggregatorLabel(aggregatorName: string): string {
    return (
      AGGREGATOR_OPTIONS.find((option) => option.value === aggregatorName)?.label ?? aggregatorName
    );
  }
}
