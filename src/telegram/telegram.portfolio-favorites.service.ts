import { Injectable } from '@nestjs/common';
import type { Context } from 'telegraf';

import {
  buildErrorMessage,
  buildFavoriteQuoteMessage,
  buildFavoritesMessage,
  buildInfoMessage,
} from './telegram.message-formatters';
import { TelegramPortfolioParserService } from './telegram.portfolio-parser.service';
import type { IFavoriteActionPayload } from './telegram.portfolio.service';
import { PriceAlertsService } from '../alerts/price-alerts.service';
import { FavoritesService } from '../favorites/favorites.service';
import { WalletConnectSessionStore } from '../wallet-connect/wallet-connect.session-store';

@Injectable()
export class TelegramPortfolioFavoritesService {
  public constructor(
    private readonly favoritesService: FavoritesService,
    private readonly priceAlertsService: PriceAlertsService,
    private readonly sessionStore: WalletConnectSessionStore,
    private readonly telegramPortfolioParserService: TelegramPortfolioParserService,
  ) {}

  public buildFavoriteActionButtons(
    input: IFavoriteActionPayload & { userId: string },
  ): { text: string; callback_data: string }[][] {
    const favoriteToken = this.telegramPortfolioParserService.createToken();
    const alertToken = this.telegramPortfolioParserService.createToken();
    const payload = {
      chain: input.chain,
      amount: input.amount,
      fromTokenAddress: input.fromTokenAddress,
      toTokenAddress: input.toTokenAddress,
    } satisfies IFavoriteActionPayload;

    this.sessionStore.createPendingAction({
      token: favoriteToken,
      userId: input.userId,
      kind: 'favorite',
      payload,
    });
    this.sessionStore.createPendingAction({
      token: alertToken,
      userId: input.userId,
      kind: 'favorite',
      payload,
    });

    return [
      [
        {
          text: '⭐ В избранное',
          callback_data:
            this.telegramPortfolioParserService.buildFavoriteAddCallbackData(favoriteToken),
        },
        {
          text: '🔔 Алерт',
          callback_data:
            this.telegramPortfolioParserService.buildFavoriteAlertCallbackData(alertToken),
        },
      ],
    ];
  }

  public async handleFavorites(context: Context, userId: string): Promise<void> {
    const favorites = await this.favoritesService.listFavorites(userId);

    if (favorites.length === 0) {
      await context.reply(buildFavoritesMessage([]), { parse_mode: 'HTML' });
      return;
    }

    const keyboard = [] as { text: string; callback_data: string }[][];
    const items = [] as {
      favorite: (typeof favorites)[number];
      currentNetText: string;
      bestAggregator: string;
      alertText: string;
    }[];

    for (const favorite of favorites) {
      const alert = await this.priceAlertsService.getActiveAlertForFavorite(favorite.id);

      try {
        const quote = await this.favoritesService.getBestQuoteForFavorite(favorite);
        items.push({
          favorite,
          currentNetText: quote.toAmount,
          bestAggregator: quote.aggregator,
          alertText: alert ? `активен на ${alert.targetToAmount} ${favorite.toTokenSymbol}` : 'нет',
        });
      } catch (error: unknown) {
        items.push({
          favorite,
          currentNetText: `недоступно: ${this.telegramPortfolioParserService.getErrorMessage(error)}`,
          bestAggregator: 'недоступно',
          alertText: alert ? `активен на ${alert.targetToAmount} ${favorite.toTokenSymbol}` : 'нет',
        });
      }

      keyboard.push([
        {
          text: `Проверить ${favorite.fromTokenSymbol}/${favorite.toTokenSymbol}`,
          callback_data: this.telegramPortfolioParserService.buildFavoriteCheckCallbackData(
            favorite.id,
          ),
        },
      ]);
      keyboard.push([
        {
          text: 'Установить алерт',
          callback_data: this.telegramPortfolioParserService.buildFavoriteAlertCallbackData(
            favorite.id,
          ),
        },
        {
          text: 'Удалить',
          callback_data: this.telegramPortfolioParserService.buildFavoriteDeleteCallbackData(
            favorite.id,
          ),
        },
      ]);
    }

    await context.reply(buildFavoritesMessage(items), {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  public async handleFavoriteAdd(context: Context, userId: string, data: string): Promise<void> {
    const token = this.telegramPortfolioParserService.getFavoriteAddToken(data);
    const action = this.sessionStore.consumePendingAction(userId, token);

    if (!action) {
      await context.answerCbQuery('Действие истекло');
      return;
    }

    const payload = this.telegramPortfolioParserService.getFavoriteActionPayload(action.payload);
    await this.favoritesService.createFavorite({
      userId,
      chain: payload.chain,
      amount: payload.amount,
      fromTokenChain: payload.chain,
      fromTokenAddress: payload.fromTokenAddress,
      toTokenChain: payload.chain,
      toTokenAddress: payload.toTokenAddress,
    });
    await context.answerCbQuery('Пара сохранена');
    await context.reply(
      buildInfoMessage('Пара добавлена в избранное. Открой /favorites для управления.'),
      { parse_mode: 'HTML' },
    );
  }

  public async handleFavoriteCheck(context: Context, userId: string, data: string): Promise<void> {
    const favoriteId = this.telegramPortfolioParserService.getFavoriteCheckId(data);
    await context.answerCbQuery('Обновляю курс...');
    const favorite = await this.favoritesService.getFavorite(userId, favoriteId);

    if (!favorite) {
      await context.reply(buildErrorMessage('Избранная пара не найдена.'), {
        parse_mode: 'HTML',
      });
      return;
    }

    const quote = await this.favoritesService.getBestQuoteForFavorite(favorite);
    const alert = await this.priceAlertsService.getActiveAlertForFavorite(favorite.id);

    await context.reply(
      buildFavoriteQuoteMessage({
        amount: favorite.amount,
        fromSymbol: favorite.fromTokenSymbol,
        toSymbol: favorite.toTokenSymbol,
        chain: favorite.chain,
        currentNet: quote.toAmount,
        bestAggregator: quote.aggregator,
        alertText: alert ? `${alert.targetToAmount} ${favorite.toTokenSymbol}` : 'не установлен',
      }),
      { parse_mode: 'HTML' },
    );
  }

  public async handleFavoriteDelete(context: Context, userId: string, data: string): Promise<void> {
    const favoriteId = this.telegramPortfolioParserService.getFavoriteDeleteId(data);
    await context.answerCbQuery('Удаляю...');
    const deleted = await this.favoritesService.deleteFavorite(userId, favoriteId);

    if (!deleted) {
      await context.reply(buildInfoMessage('Избранная пара уже удалена или не найдена.'), {
        parse_mode: 'HTML',
      });
      return;
    }

    await context.reply(buildInfoMessage('Избранная пара удалена.'), { parse_mode: 'HTML' });
  }
}
