import { Injectable, Logger } from '@nestjs/common';
import type { Context, Telegraf } from 'telegraf';
import type { InlineKeyboardButton, Message } from 'telegraf/typings/core/types/typegram';

import { BusinessException } from '../common/exceptions/business.exception';
import type { IUserSettings } from '../settings/interfaces/user-settings.interface';
import { UserSettingsService } from '../settings/user-settings.service';

const CALLBACK_PREFIX = 's:';

const SLIPPAGE_PRESET_LOW = 0.1;
const SLIPPAGE_PRESET_DEFAULT = 0.5;
const SLIPPAGE_PRESET_MEDIUM = 1;
const SLIPPAGE_PRESET_HIGH = 3;
const SLIPPAGE_PRESETS = [
  SLIPPAGE_PRESET_LOW,
  SLIPPAGE_PRESET_DEFAULT,
  SLIPPAGE_PRESET_MEDIUM,
  SLIPPAGE_PRESET_HIGH,
] as const;
const MIN_CUSTOM_SLIPPAGE = 0.01;
const MAX_CUSTOM_SLIPPAGE = 50;

const AGGREGATOR_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'auto', label: 'Авто (лучшая цена)' },
  { value: 'paraswap', label: 'ParaSwap' },
  { value: 'zerox', label: '0x' },
  { value: 'odos', label: 'Odos' },
  { value: 'jupiter', label: 'Jupiter (Solana)' },
];

interface IPendingInput {
  field: 'slippage';
  chatId: number;
}

@Injectable()
export class TelegramSettingsHandler {
  private readonly logger = new Logger(TelegramSettingsHandler.name);
  private readonly pendingInputs = new Map<string, IPendingInput>();

  public constructor(private readonly userSettingsService: UserSettingsService) {}

  public register(bot: Telegraf): void {
    bot.command('settings', async (context: Context) => this.handleSettingsCommand(context));

    bot.action(new RegExp(`^${CALLBACK_PREFIX}`), async (context: Context) =>
      this.handleCallback(context),
    );
  }

  public hasPendingInput(userId: string): boolean {
    return this.pendingInputs.has(userId);
  }

  public async handleTextInput(context: Context): Promise<void> {
    const from = context.from;

    if (!from) {
      return;
    }

    const userId = from.id.toString();
    const pending = this.pendingInputs.get(userId);

    if (!pending) {
      return;
    }

    this.pendingInputs.delete(userId);

    const message = context.message as Message | undefined;
    const text =
      message && 'text' in message && typeof message.text === 'string' ? message.text.trim() : '';

    if (text === '') {
      await context.reply('Значение не распознано. Попробуй ещё раз через /settings.');
      return;
    }

    await this.processCustomSlippage(context, userId, text);
  }

  private async handleSettingsCommand(context: Context): Promise<void> {
    const from = context.from;

    if (!from) {
      return;
    }

    const userId = from.id.toString();
    this.pendingInputs.delete(userId);

    try {
      const settings = await this.userSettingsService.getSettings(userId);

      await context.reply(this.buildMainMenuText(settings), {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: this.buildMainMenuKeyboard(),
        },
      });
    } catch (error: unknown) {
      this.logger.error(`Settings command failed: ${this.getErrorMessage(error)}`);
      await context.reply('Не удалось загрузить настройки. Попробуй позже.');
    }
  }

  private async handleCallback(context: Context): Promise<void> {
    const callbackQuery = context.callbackQuery;

    if (!callbackQuery || !('data' in callbackQuery)) {
      return;
    }

    const from = callbackQuery.from;
    const userId = from.id.toString();
    const data = callbackQuery.data;

    this.pendingInputs.delete(userId);

    try {
      await this.routeCallback(context, userId, data);
    } catch (error: unknown) {
      const message = this.getErrorMessage(error);
      this.logger.error(`Settings callback failed: ${message}`);
      await context.answerCbQuery(`Ошибка: ${message}`);
    }
  }

  private async routeCallback(context: Context, userId: string, data: string): Promise<void> {
    if (data === 's:menu') {
      await this.showMainMenu(context, userId);
      return;
    }

    if (data === 's:slip:menu') {
      await this.showSlippageMenu(context);
      return;
    }

    if (data === 's:slip:custom') {
      await this.requestCustomSlippage(context, userId);
      return;
    }

    if (data.startsWith('s:slip:')) {
      const value = Number.parseFloat(data.slice('s:slip:'.length));
      await this.setSlippage(context, userId, value);
      return;
    }

    if (data === 's:agg:menu') {
      await this.showAggregatorMenu(context, userId);
      return;
    }

    if (data.startsWith('s:agg:')) {
      const aggregatorName = data.slice('s:agg:'.length);
      await this.setAggregator(context, userId, aggregatorName);
      return;
    }

    await context.answerCbQuery('Неизвестная команда');
  }

  private async showMainMenu(context: Context, userId: string): Promise<void> {
    const settings = await this.userSettingsService.getSettings(userId);

    await context.editMessageText(this.buildMainMenuText(settings), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: this.buildMainMenuKeyboard(),
      },
    });
    await context.answerCbQuery();
  }

  private async showSlippageMenu(context: Context): Promise<void> {
    const presetButtons: InlineKeyboardButton[] = SLIPPAGE_PRESETS.map((value) => ({
      text: `${value}%`,
      callback_data: `s:slip:${value}`,
    }));

    await context.editMessageText('Выбери slippage:', {
      reply_markup: {
        inline_keyboard: [
          presetButtons,
          [{ text: 'Ввести вручную', callback_data: 's:slip:custom' }],
          [{ text: 'Назад', callback_data: 's:menu' }],
        ],
      },
    });
    await context.answerCbQuery();
  }

  private async showAggregatorMenu(context: Context, userId: string): Promise<void> {
    const settings = await this.userSettingsService.getSettings(userId);
    const buttons: InlineKeyboardButton[][] = [];

    for (const option of AGGREGATOR_OPTIONS) {
      const prefix = settings.preferredAggregator === option.value ? '\u2705 ' : '';
      buttons.push([{ text: `${prefix}${option.label}`, callback_data: `s:agg:${option.value}` }]);
    }

    buttons.push([{ text: 'Назад', callback_data: 's:menu' }]);

    await context.editMessageText('Выбери агрегатор:', {
      reply_markup: { inline_keyboard: buttons },
    });
    await context.answerCbQuery();
  }

  private async setSlippage(context: Context, userId: string, value: number): Promise<void> {
    const updated = await this.userSettingsService.updateSlippage(userId, value);

    await context.editMessageText(this.buildMainMenuText(updated), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: this.buildMainMenuKeyboard(),
      },
    });
    await context.answerCbQuery(`Slippage: ${value}%`);
  }

  private async setAggregator(
    context: Context,
    userId: string,
    aggregatorName: string,
  ): Promise<void> {
    const updated = await this.userSettingsService.updatePreferredAggregator(
      userId,
      aggregatorName,
    );

    await context.editMessageText(this.buildMainMenuText(updated), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: this.buildMainMenuKeyboard(),
      },
    });
    const label =
      AGGREGATOR_OPTIONS.find((option) => option.value === aggregatorName)?.label ?? aggregatorName;
    await context.answerCbQuery(`Агрегатор: ${label}`);
  }

  private async requestCustomSlippage(context: Context, userId: string): Promise<void> {
    const chatId = context.chat?.id;

    if (!chatId) {
      return;
    }

    this.pendingInputs.set(userId, { field: 'slippage', chatId });

    await context.editMessageText(
      `Введи slippage в процентах (от ${MIN_CUSTOM_SLIPPAGE} до ${MAX_CUSTOM_SLIPPAGE}):`,
    );
    await context.answerCbQuery();
  }

  private async processCustomSlippage(
    context: Context,
    userId: string,
    text: string,
  ): Promise<void> {
    const value = Number.parseFloat(text.replace(',', '.'));

    if (!Number.isFinite(value) || value < MIN_CUSTOM_SLIPPAGE || value > MAX_CUSTOM_SLIPPAGE) {
      await context.reply(
        `Некорректное значение. Slippage должен быть от ${MIN_CUSTOM_SLIPPAGE}% до ${MAX_CUSTOM_SLIPPAGE}%.`,
      );
      return;
    }

    try {
      const updated = await this.userSettingsService.updateSlippage(userId, value);

      await context.reply(this.buildMainMenuText(updated), {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: this.buildMainMenuKeyboard(),
        },
      });
    } catch (error: unknown) {
      const message = this.getErrorMessage(error);
      await context.reply(`Ошибка: ${message}`);
    }
  }

  private buildMainMenuText(settings: IUserSettings): string {
    const aggregatorLabel =
      AGGREGATOR_OPTIONS.find((option) => option.value === settings.preferredAggregator)?.label ??
      settings.preferredAggregator;

    return [
      '<b>Настройки свопа</b>',
      '',
      `Slippage: <b>${settings.slippage}%</b>`,
      `Агрегатор: <b>${aggregatorLabel}</b>`,
    ].join('\n');
  }

  private buildMainMenuKeyboard(): InlineKeyboardButton[][] {
    return [
      [
        { text: 'Slippage', callback_data: 's:slip:menu' },
        { text: 'Агрегатор', callback_data: 's:agg:menu' },
      ],
    ];
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof BusinessException) {
      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Внутренняя ошибка';
  }
}
