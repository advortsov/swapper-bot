import { Injectable, Logger } from '@nestjs/common';
import type { Context } from 'telegraf';

import {
  buildAlertCreatedMessage,
  buildAlertPromptMessage,
  buildErrorMessage,
  buildInfoMessage,
} from './telegram.message-formatters';
import { TelegramPortfolioParserService } from './telegram.portfolio-parser.service';
import { PriceAlertsService } from '../alerts/price-alerts.service';
import { FavoritesService } from '../favorites/favorites.service';
import { WalletConnectSessionStore } from '../wallet-connect/wallet-connect.session-store';

@Injectable()
export class TelegramPortfolioAlertsService {
  private readonly logger = new Logger(TelegramPortfolioAlertsService.name);

  public constructor(
    private readonly priceAlertsService: PriceAlertsService,
    private readonly favoritesService: FavoritesService,
    private readonly sessionStore: WalletConnectSessionStore,
    private readonly telegramPortfolioParserService: TelegramPortfolioParserService,
  ) {}

  public async handleFavoriteAlert(context: Context, userId: string, data: string): Promise<void> {
    const suffix = this.telegramPortfolioParserService.getFavoriteAlertSuffix(data);
    let favoriteId = suffix;

    if (!this.telegramPortfolioParserService.looksLikeUuid(favoriteId)) {
      const action = this.sessionStore.consumePendingAction(userId, suffix);

      if (!action) {
        await context.answerCbQuery('Действие истекло');
        return;
      }

      const payload = this.telegramPortfolioParserService.getFavoriteActionPayload(action.payload);
      const favorite = await this.favoritesService.createFavorite({
        userId,
        chain: payload.chain,
        amount: payload.amount,
        fromTokenChain: payload.chain,
        fromTokenAddress: payload.fromTokenAddress,
        toTokenChain: payload.chain,
        toTokenAddress: payload.toTokenAddress,
      });
      favoriteId = favorite.id;
    }

    this.sessionStore.createPendingAction({
      token: this.telegramPortfolioParserService.createToken(),
      userId,
      kind: 'alert-threshold',
      payload: { favoriteId },
    });

    await context.answerCbQuery('Жду порог');
    await context.reply(buildAlertPromptMessage(), { parse_mode: 'HTML' });
  }

  public async handleAlertThresholdInput(
    context: Context,
    userId: string,
    text: string,
  ): Promise<boolean> {
    const pending = this.sessionStore.getPendingActionByUser(userId, 'alert-threshold');

    if (!pending) {
      return false;
    }

    const consumedPending = this.sessionStore.consumePendingAction(userId, pending.token);

    if (!consumedPending) {
      await context.reply(
        buildErrorMessage('Ввод порога истёк. Открой /favorites и начни заново.'),
        { parse_mode: 'HTML' },
      );
      return true;
    }

    try {
      const favoriteIdValue = consumedPending.payload['favoriteId'];
      const favoriteId = typeof favoriteIdValue === 'string' ? favoriteIdValue : '';
      const alert = await this.priceAlertsService.upsertAlert(userId, favoriteId, text);
      const favorite = await this.favoritesService.getFavorite(userId, favoriteId);

      await context.reply(
        favorite
          ? buildAlertCreatedMessage({
              targetToAmount: alert.targetToAmount,
              toTokenSymbol: favorite.toTokenSymbol,
              amount: favorite.amount,
              fromTokenSymbol: favorite.fromTokenSymbol,
            })
          : buildInfoMessage('Алерт установлен.'),
        {
          parse_mode: 'HTML',
        },
      );
    } catch (error: unknown) {
      this.sessionStore.createPendingAction({
        token: this.telegramPortfolioParserService.createToken(),
        userId,
        kind: 'alert-threshold',
        payload: consumedPending.payload,
      });
      this.logger.error(
        `Alert threshold failed: ${this.telegramPortfolioParserService.getErrorMessage(error)}`,
      );
      await context.reply(
        buildErrorMessage(this.telegramPortfolioParserService.getErrorMessage(error)),
        {
          parse_mode: 'HTML',
        },
      );
    }

    return true;
  }
}
