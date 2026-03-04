import { Inject, Injectable } from '@nestjs/common';
import type { Context } from 'telegraf';

import { TelegramConnectionsService } from './telegram.connections.service';
import { TelegramErrorReplyService } from './telegram.error-reply.service';
import { TelegramPortfolioService } from './telegram.portfolio.service';
import { TelegramSettingsHandler } from './telegram.settings-handler';
import { TelegramTradingService } from './telegram.trading.service';

@Injectable()
export class TelegramCommandRouterService {
  @Inject()
  private readonly errorReplyService!: TelegramErrorReplyService;

  public constructor(
    private readonly settingsHandler: TelegramSettingsHandler,
    private readonly tradingService: TelegramTradingService,
    private readonly portfolioService: TelegramPortfolioService,
    private readonly connectionsService: TelegramConnectionsService,
  ) {}

  public async handleText(context: Context): Promise<void> {
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

  public async handlePrice(context: Context): Promise<void> {
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
      await this.errorReplyService.replyWithError(context, 'Price command failed', error);
    }
  }

  public async handleSwap(context: Context): Promise<void> {
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
      await this.errorReplyService.replyWithError(context, 'Swap command failed', error);
    }
  }

  public async handleApprove(context: Context): Promise<void> {
    const from = context.from;
    const text = this.getMessageText(context.message);

    if (!from || text === '') {
      await context.reply('Команда не распознана. Пример: /approve 100 USDC on ethereum');
      return;
    }

    try {
      await this.tradingService.handleApprove(
        context,
        from.id.toString(),
        from.username ?? null,
        text,
      );
    } catch (error: unknown) {
      await this.errorReplyService.replyWithError(context, 'Approve command failed', error);
    }
  }

  public async handleConnect(context: Context): Promise<void> {
    const from = context.from;
    const text = this.getMessageText(context.message) || '/connect';

    if (!from) {
      return;
    }

    try {
      await this.connectionsService.handleConnect(context, from.id.toString(), text);
    } catch (error: unknown) {
      await this.errorReplyService.replyWithError(context, 'Connect command failed', error);
    }
  }

  public async handleDisconnect(context: Context): Promise<void> {
    const from = context.from;
    const text = this.getMessageText(context.message) || '/disconnect';

    if (!from) {
      return;
    }

    try {
      await this.connectionsService.handleDisconnect(context, from.id.toString(), text);
    } catch (error: unknown) {
      await this.errorReplyService.replyWithError(context, 'Disconnect command failed', error);
    }
  }

  public async handleFavorites(context: Context): Promise<void> {
    const from = context.from;

    if (!from) {
      return;
    }

    try {
      await this.portfolioService.handleFavorites(context, from.id.toString());
    } catch (error: unknown) {
      await this.errorReplyService.replyWithError(context, 'Favorites command failed', error);
    }
  }

  public async handleHistory(context: Context): Promise<void> {
    const from = context.from;

    if (!from) {
      return;
    }

    try {
      await this.portfolioService.handleHistory(context, from.id.toString());
    } catch (error: unknown) {
      await this.errorReplyService.replyWithError(context, 'History command failed', error);
    }
  }

  private getMessageText(messageInput: unknown): string {
    if (typeof messageInput !== 'object' || messageInput === null) {
      return '';
    }

    const text = (messageInput as { text?: unknown }).text;
    return typeof text === 'string' ? text.trim() : '';
  }
}
