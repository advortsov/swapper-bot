import { Inject, Injectable } from '@nestjs/common';
import type { Context } from 'telegraf';

import { TelegramConnectionsService } from './telegram.connections.service';
import { TelegramErrorReplyService } from './telegram.error-reply.service';
import { TelegramPortfolioService } from './telegram.portfolio.service';
import { TelegramTradeTemplatesService } from './telegram.trade-templates.service';
import { TelegramTradingParserService } from './telegram.trading-parser.service';
import { TelegramTradingService } from './telegram.trading.service';

@Injectable()
export class TelegramCallbackRouterService {
  @Inject()
  private readonly templatesService!: TelegramTradeTemplatesService;

  @Inject()
  private readonly tradingParserService!: TelegramTradingParserService;

  public constructor(
    private readonly tradingService: TelegramTradingService,
    private readonly portfolioService: TelegramPortfolioService,
    private readonly connectionsService: TelegramConnectionsService,
    private readonly errorReplyService: TelegramErrorReplyService,
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
    if (await this.routeTradingAction(context, userId, data)) return;
    if (await this.routePortfolioAction(context, userId, data)) return;
    await this.routeConnectionAction(context, userId, data);
  }

  private async routeTradingAction(
    context: Context,
    userId: string,
    data: string,
  ): Promise<boolean> {
    if (this.tradingService.isRiskCallback(data)) {
      await this.tradingService.handleRiskCallback(context, userId, data, this.connectionsService);
      return true;
    }

    if (this.tradingService.isSwapCallback(data)) {
      await this.tradingService.handleSwapCallback(context, userId, data, this.connectionsService);
      return true;
    }

    if (this.tradingService.isApproveCallback(data)) {
      await this.tradingService.handleApproveCallback(
        context,
        userId,
        data,
        this.connectionsService,
      );
      return true;
    }

    if (this.tradingService.isPresetSaveCallback(data)) {
      const token = this.tradingParserService.parsePresetSaveToken(data);
      await this.templatesService.handlePresetSaveByToken(context, userId, token);
      return true;
    }

    return false;
  }

  private async routePortfolioAction(
    context: Context,
    userId: string,
    data: string,
  ): Promise<boolean> {
    if (this.portfolioService.isFavoriteAdd(data)) {
      await this.portfolioService.handleFavoriteAdd(context, userId, data);
      return true;
    }

    if (this.portfolioService.isFavoriteCheck(data)) {
      await this.portfolioService.handleFavoriteCheck(context, userId, data);
      return true;
    }

    if (this.portfolioService.isFavoriteAlert(data)) {
      await this.portfolioService.handleFavoriteAlert(context, userId, data);
      return true;
    }

    if (this.portfolioService.isFavoriteDelete(data)) {
      await this.portfolioService.handleFavoriteDelete(context, userId, data);
      return true;
    }

    return false;
  }

  private async routeConnectionAction(
    context: Context,
    userId: string,
    data: string,
  ): Promise<void> {
    if (this.connectionsService.isConnectAction(data)) {
      await this.connectionsService.handleConnectAction(context, userId, data);
      return;
    }

    if (this.connectionsService.isDisconnectAction(data)) {
      await this.connectionsService.handleDisconnectAction(context, userId, data);
    }
  }
}
