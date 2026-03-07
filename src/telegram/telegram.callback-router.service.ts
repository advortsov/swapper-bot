import { Injectable } from '@nestjs/common';
import type { Context } from 'telegraf';

import { TelegramConnectionsService } from './telegram.connections.service';
import { TelegramErrorReplyService } from './telegram.error-reply.service';
import { TelegramPortfolioService } from './telegram.portfolio.service';
import { TelegramTradingService } from './telegram.trading.service';
import { TelegramTradingParserService } from './telegram.trading-parser.service';
import { TelegramTradeTemplatesService } from './telegram.trade-templates.service';

@Injectable()
export class TelegramCallbackRouterService {
  public constructor(
    private readonly tradingService: TelegramTradingService,
    private readonly portfolioService: TelegramPortfolioService,
    private readonly connectionsService: TelegramConnectionsService,
    private readonly errorReplyService: TelegramErrorReplyService,
    private readonly templatesService: TelegramTradeTemplatesService,
    private readonly tradingParserService: TelegramTradingParserService,
  ) {}

  public async handleAction(context: Context): Promise<void> {
    const callbackQuery = context.callbackQuery;

    if (!callbackQuery || !('data' in callbackQuery) || !context.from) {
      return;
    }

    const data = callbackQuery.data;
    const userId = context.from.id.toString();

    try {
      await this.routeAction(context, userId, data);
    } catch (error: unknown) {
      await this.errorReplyService.replyWithError(context, 'Telegram action failed', error);
    }
  }

  private async routeAction(context: Context, userId: string, data: string): Promise<void> {
    if (this.tradingService.isRiskCallback(data)) {
      await this.tradingService.handleRiskCallback(context, userId, data, this.connectionsService);
      return;
    }

    if (this.tradingService.isSwapCallback(data)) {
      await this.tradingService.handleSwapCallback(context, userId, data, this.connectionsService);
      return;
    }

    if (this.tradingService.isApproveCallback(data)) {
      await this.tradingService.handleApproveCallback(
        context,
        userId,
        data,
        this.connectionsService,
      );
      return;
    }

    if (this.tradingService.isPresetSaveCallback(data)) {
      const payload = this.tradingParserService.parsePresetSaveData(data);
      await this.templatesService.handlePresetSave(context, userId, payload);
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
}
