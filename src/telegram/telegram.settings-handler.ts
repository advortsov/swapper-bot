import { Injectable, Logger } from '@nestjs/common';
import type { Context, Telegraf } from 'telegraf';
import type { Message } from 'telegraf/typings/core/types/typegram';

import { TelegramSettingsMenuService } from './telegram.settings-menu.service';
import { TelegramSettingsParserService } from './telegram.settings-parser.service';
import { TelegramSettingsPersistenceService } from './telegram.settings-persistence.service';
import { TelegramSettingsReplyService } from './telegram.settings-reply.service';
import { BusinessException } from '../common/exceptions/business.exception';

interface IPendingInput {
  field: 'slippage';
  chatId: number;
}

@Injectable()
export class TelegramSettingsHandler {
  private readonly logger = new Logger(TelegramSettingsHandler.name);
  private readonly pendingInputs = new Map<string, IPendingInput>();

  public constructor(
    private readonly parserService: TelegramSettingsParserService,
    private readonly persistenceService: TelegramSettingsPersistenceService,
    private readonly replyService: TelegramSettingsReplyService,
    private readonly menuService: TelegramSettingsMenuService,
  ) {}

  public register(bot: Telegraf): void {
    bot.command('settings', async (context: Context) => this.handleSettingsCommand(context));

    bot.action(this.parserService.getCallbackPattern(), async (context: Context) =>
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
    const text = this.parserService.parseText(message);

    if (text === '') {
      await this.replyService.replyError(
        context,
        'Значение не распознано. Попробуй ещё раз через /settings.',
      );
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
      const settings = await this.persistenceService.getSettings(userId);

      await this.replyService.replyMainMenu(context, settings);
    } catch (error: unknown) {
      this.logger.error(`Settings command failed: ${this.getErrorMessage(error)}`);
      await this.replyService.replyError(
        context,
        'Не удалось загрузить настройки. Попробуй позже.',
      );
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
      await this.routeCallback(context, userId, this.parserService.parseCallback(data));
    } catch (error: unknown) {
      const message = this.getErrorMessage(error);
      this.logger.error(`Settings callback failed: ${message}`);
      await context.answerCbQuery(`❌ ${message}`);
    }
  }

  private async routeCallback(
    context: Context,
    userId: string,
    action: ReturnType<TelegramSettingsParserService['parseCallback']>,
  ): Promise<void> {
    switch (action.kind) {
      case 'menu':
        await this.showMainMenu(context, userId);
        return;
      case 'slippage-menu':
        await this.showSlippageMenu(context);
        return;
      case 'slippage-custom':
        await this.requestCustomSlippage(context, userId);
        return;
      case 'slippage-value':
        await this.setSlippage(context, userId, action.value);
        return;
      case 'aggregator-menu':
        await this.showAggregatorMenu(context, userId);
        return;
      case 'aggregator-value':
        await this.setAggregator(context, userId, action.aggregatorName);
        return;
      default:
        await context.answerCbQuery('Неизвестная команда');
    }
  }

  private async showMainMenu(context: Context, userId: string): Promise<void> {
    const settings = await this.persistenceService.getSettings(userId);
    await this.replyService.editMainMenu(context, settings);
    await context.answerCbQuery();
  }

  private async showSlippageMenu(context: Context): Promise<void> {
    await this.replyService.editSlippageMenu(context);
    await context.answerCbQuery();
  }

  private async showAggregatorMenu(context: Context, userId: string): Promise<void> {
    const settings = await this.persistenceService.getSettings(userId);
    await this.replyService.editAggregatorMenu(context, settings);
    await context.answerCbQuery();
  }

  private async setSlippage(context: Context, userId: string, value: number): Promise<void> {
    const updated = await this.persistenceService.updateSlippage(userId, value);

    await this.replyService.editMainMenu(context, updated);
    await context.answerCbQuery(`Slippage: ${value}%`);
  }

  private async setAggregator(
    context: Context,
    userId: string,
    aggregatorName: string,
  ): Promise<void> {
    const updated = await this.persistenceService.updatePreferredAggregator(userId, aggregatorName);

    await this.replyService.editMainMenu(context, updated);
    const label = this.menuService.getAggregatorLabel(aggregatorName);
    await context.answerCbQuery(`Агрегатор: ${label}`);
  }

  private async requestCustomSlippage(context: Context, userId: string): Promise<void> {
    const chatId = context.chat?.id;

    if (!chatId) {
      return;
    }

    this.pendingInputs.set(userId, { field: 'slippage', chatId });

    await this.replyService.editCustomSlippagePrompt(context);
    await context.answerCbQuery();
  }

  private async processCustomSlippage(
    context: Context,
    userId: string,
    text: string,
  ): Promise<void> {
    try {
      const value = this.persistenceService.parseCustomSlippage(text);
      const updated = await this.persistenceService.updateSlippage(userId, value);

      await this.replyService.replyMainMenu(context, updated);
    } catch (error: unknown) {
      const message = this.getErrorMessage(error);
      await this.replyService.replyError(context, message);
    }
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
