import { Injectable, Logger } from '@nestjs/common';
import type { Context, Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';

import { TelegramConnectionsService } from './telegram.connections.service';
import {
  buildErrorMessage,
  buildHelpMessage,
  buildStartMessage,
} from './telegram.message-formatters';
import { TelegramPortfolioService } from './telegram.portfolio.service';
import { TelegramSettingsHandler } from './telegram.settings-handler';
import { TelegramTradingService } from './telegram.trading.service';

@Injectable()
export class TelegramUpdateHandler {
  private readonly logger = new Logger(TelegramUpdateHandler.name);

  public constructor(
    private readonly settingsHandler: TelegramSettingsHandler,
    private readonly tradingService: TelegramTradingService,
    private readonly portfolioService: TelegramPortfolioService,
    private readonly connectionsService: TelegramConnectionsService,
  ) {}

  public register(bot: Telegraf): void {
    bot.command('start', async (context: Context) => this.handleStart(context));
    bot.command('help', async (context: Context) => this.handleHelp(context));
    bot.command('price', async (context: Context) => this.handlePrice(context));
    bot.command('swap', async (context: Context) => this.handleSwap(context));
    bot.command('connect', async (context: Context) => this.handleConnect(context));
    bot.command('disconnect', async (context: Context) => this.handleDisconnect(context));
    bot.command('favorites', async (context: Context) => this.handleFavorites(context));
    bot.command('history', async (context: Context) => this.handleHistory(context));
    this.settingsHandler.register(bot);
    bot.action(/.*/, async (context: Context) => this.handleAction(context));
    bot.on(message('text'), async (context: Context) => this.handleText(context));
  }

  private async handleText(context: Context): Promise<void> {
    const from = context.from;

    if (!from) {
      return;
    }

    const text = this.getMessageText(context.message);

    if (this.settingsHandler.hasPendingInput(from.id.toString())) {
      await this.settingsHandler.handleTextInput(context);
      return;
    }

    if (text !== '') {
      await this.portfolioService.handleAlertThresholdInput(context, from.id.toString(), text);
    }
  }

  private async handleStart(context: Context): Promise<void> {
    await context.reply(buildStartMessage(), { parse_mode: 'HTML' });
  }

  private async handleHelp(context: Context): Promise<void> {
    await context.reply(buildHelpMessage(), { parse_mode: 'HTML' });
  }

  private async handlePrice(context: Context): Promise<void> {
    const from = context.from;
    const text = this.getMessageText(context.message);

    if (!from || text === '') {
      await context.reply('Команда не распознана. Пример: /price 10 USDC to USDT');
      return;
    }

    try {
      await this.tradingService.handlePrice(
        context,
        from.id.toString(),
        from.username ?? null,
        text,
      );
    } catch (error: unknown) {
      await this.replyWithError(context, 'Price command failed', error);
    }
  }

  private async handleSwap(context: Context): Promise<void> {
    const from = context.from;
    const text = this.getMessageText(context.message);

    if (!from || text === '') {
      await context.reply('Команда не распознана. Пример: /swap 10 USDC to USDT');
      return;
    }

    try {
      await this.tradingService.handleSwap(
        context,
        from.id.toString(),
        from.username ?? null,
        text,
      );
    } catch (error: unknown) {
      await this.replyWithError(context, 'Swap command failed', error);
    }
  }

  private async handleConnect(context: Context): Promise<void> {
    const from = context.from;
    const text = this.getMessageText(context.message) || '/connect';

    if (!from) {
      return;
    }

    try {
      await this.connectionsService.handleConnect(context, from.id.toString(), text);
    } catch (error: unknown) {
      await this.replyWithError(context, 'Connect command failed', error);
    }
  }

  private async handleDisconnect(context: Context): Promise<void> {
    const from = context.from;
    const text = this.getMessageText(context.message) || '/disconnect';

    if (!from) {
      return;
    }

    try {
      await this.connectionsService.handleDisconnect(context, from.id.toString(), text);
    } catch (error: unknown) {
      await this.replyWithError(context, 'Disconnect command failed', error);
    }
  }

  private async handleFavorites(context: Context): Promise<void> {
    const from = context.from;

    if (!from) {
      return;
    }

    try {
      await this.portfolioService.handleFavorites(context, from.id.toString());
    } catch (error: unknown) {
      await this.replyWithError(context, 'Favorites command failed', error);
    }
  }

  private async handleHistory(context: Context): Promise<void> {
    const from = context.from;

    if (!from) {
      return;
    }

    try {
      await this.portfolioService.handleHistory(context, from.id.toString());
    } catch (error: unknown) {
      await this.replyWithError(context, 'History command failed', error);
    }
  }

  private async handleAction(context: Context): Promise<void> {
    const callbackQuery = context.callbackQuery;

    if (!callbackQuery || !('data' in callbackQuery) || !context.from) {
      return;
    }

    const data = callbackQuery.data;
    const userId = context.from.id.toString();

    try {
      await this.routeAction(context, userId, data);
    } catch (error: unknown) {
      await this.replyWithError(context, 'Telegram action failed', error);
    }
  }

  private async routeAction(context: Context, userId: string, data: string): Promise<void> {
    if (this.tradingService.isSwapCallback(data)) {
      await this.tradingService.handleSwapCallback(context, userId, data, this.connectionsService);
      return;
    }

    if (this.portfolioService.isFavoriteAdd(data)) {
      await this.portfolioService.handleFavoriteAdd(context, userId, data);
      return;
    }

    if (this.portfolioService.isFavoriteCheck(data)) {
      await this.portfolioService.handleFavoriteCheck(context, userId, data);
      return;
    }

    if (this.portfolioService.isFavoriteAlert(data)) {
      await this.portfolioService.handleFavoriteAlert(context, userId, data);
      return;
    }

    if (this.portfolioService.isFavoriteDelete(data)) {
      await this.portfolioService.handleFavoriteDelete(context, userId, data);
      return;
    }

    if (this.connectionsService.isConnectAction(data)) {
      await this.connectionsService.handleConnectAction(context, userId, data);
      return;
    }

    if (this.connectionsService.isDisconnectAction(data)) {
      await this.connectionsService.handleDisconnectAction(context, userId, data);
    }
  }

  private getMessageText(messageInput: unknown): string {
    if (typeof messageInput !== 'object' || messageInput === null) {
      return '';
    }

    const text = (messageInput as { text?: unknown }).text;
    return typeof text === 'string' ? text.trim() : '';
  }

  private async replyWithError(context: Context, prefix: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`${prefix}: ${message}`);
    await context.reply(buildErrorMessage(message), { parse_mode: 'HTML' });
  }
}
