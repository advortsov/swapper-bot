import { Injectable } from '@nestjs/common';
import type { Context } from 'telegraf';

import { TelegramPortfolioAlertsService } from './telegram.portfolio-alerts.service';
import { TelegramPortfolioFavoritesService } from './telegram.portfolio-favorites.service';
import { TelegramPortfolioHistoryService } from './telegram.portfolio-history.service';
import { TelegramPortfolioParserService } from './telegram.portfolio-parser.service';
import type { ChainType } from '../chains/interfaces/chain.interface';

export interface IFavoriteActionPayload {
  chain: ChainType;
  amount: string;
  fromTokenAddress: string;
  toTokenAddress: string;
}

@Injectable()
export class TelegramPortfolioService {
  public constructor(
    private readonly telegramPortfolioParserService: TelegramPortfolioParserService,
    private readonly telegramPortfolioFavoritesService: TelegramPortfolioFavoritesService,
    private readonly telegramPortfolioAlertsService: TelegramPortfolioAlertsService,
    private readonly telegramPortfolioHistoryService: TelegramPortfolioHistoryService,
  ) {}

  public buildFavoriteActionButtons(
    input: IFavoriteActionPayload & { userId: string },
  ): { text: string; callback_data: string }[][] {
    return this.telegramPortfolioFavoritesService.buildFavoriteActionButtons(input);
  }

  public async handleFavorites(context: Context, userId: string): Promise<void> {
    await this.telegramPortfolioFavoritesService.handleFavorites(context, userId);
  }

  public async handleHistory(context: Context, userId: string): Promise<void> {
    await this.telegramPortfolioHistoryService.handleHistory(context, userId);
  }

  public async handleFavoriteAdd(context: Context, userId: string, data: string): Promise<void> {
    await this.telegramPortfolioFavoritesService.handleFavoriteAdd(context, userId, data);
  }

  public async handleFavoriteCheck(context: Context, userId: string, data: string): Promise<void> {
    await this.telegramPortfolioFavoritesService.handleFavoriteCheck(context, userId, data);
  }

  public async handleFavoriteAlert(context: Context, userId: string, data: string): Promise<void> {
    await this.telegramPortfolioAlertsService.handleFavoriteAlert(context, userId, data);
  }

  public async handleFavoriteDelete(context: Context, userId: string, data: string): Promise<void> {
    await this.telegramPortfolioFavoritesService.handleFavoriteDelete(context, userId, data);
  }

  public async handleAlertThresholdInput(
    context: Context,
    userId: string,
    text: string,
  ): Promise<boolean> {
    return this.telegramPortfolioAlertsService.handleAlertThresholdInput(context, userId, text);
  }

  public isFavoriteAdd(data: string): boolean {
    return this.telegramPortfolioParserService.isFavoriteAdd(data);
  }

  public isFavoriteCheck(data: string): boolean {
    return this.telegramPortfolioParserService.isFavoriteCheck(data);
  }

  public isFavoriteAlert(data: string): boolean {
    return this.telegramPortfolioParserService.isFavoriteAlert(data);
  }

  public isFavoriteDelete(data: string): boolean {
    return this.telegramPortfolioParserService.isFavoriteDelete(data);
  }
}
