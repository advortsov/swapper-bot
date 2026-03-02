import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Context } from 'telegraf';

import { PriceAlertsService } from '../alerts/price-alerts.service';
import type { ChainType } from '../chains/interfaces/chain.interface';
import { BusinessException } from '../common/exceptions/business.exception';
import { FavoritesService } from '../favorites/favorites.service';
import { SwapHistoryService } from '../history/swap-history.service';
import { WalletConnectSessionStore } from '../wallet-connect/wallet-connect.session-store';

const FAVORITE_ADD_PREFIX = 'fav:add:';
const FAVORITE_CHECK_PREFIX = 'fav:check:';
const FAVORITE_ALERT_PREFIX = 'fav:alert:';
const FAVORITE_DELETE_PREFIX = 'fav:del:';
const SHORT_HASH_PREFIX = 6;
const SHORT_HASH_SUFFIX = 4;
const CALLBACK_TOKEN_BYTES = 9;

export interface IFavoriteActionPayload {
  chain: ChainType;
  amount: string;
  fromTokenAddress: string;
  toTokenAddress: string;
}

@Injectable()
export class TelegramPortfolioService {
  private readonly logger = new Logger(TelegramPortfolioService.name);

  public constructor(
    private readonly favoritesService: FavoritesService,
    private readonly priceAlertsService: PriceAlertsService,
    private readonly swapHistoryService: SwapHistoryService,
    private readonly sessionStore: WalletConnectSessionStore,
  ) {}

  public buildFavoriteActionButtons(
    input: IFavoriteActionPayload & { userId: string },
  ): { text: string; callback_data: string }[][] {
    const favoriteToken = this.createToken();
    const alertToken = this.createToken();
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
        { text: '⭐ В избранное', callback_data: `${FAVORITE_ADD_PREFIX}${favoriteToken}` },
        { text: '🔔 Алерт', callback_data: `${FAVORITE_ALERT_PREFIX}${alertToken}` },
      ],
    ];
  }

  public async handleFavorites(context: Context, userId: string): Promise<void> {
    const favorites = await this.favoritesService.listFavorites(userId);

    if (favorites.length === 0) {
      await context.reply('Избранных пар пока нет. Сохрани пару кнопкой ⭐ из /price или /swap.');
      return;
    }

    const lines: string[] = ['Избранные пары:'];
    const keyboard = [] as { text: string; callback_data: string }[][];

    for (const favorite of favorites) {
      const alert = await this.priceAlertsService.getActiveAlertForFavorite(favorite.id);

      try {
        const quote = await this.favoritesService.getBestQuoteForFavorite(favorite);
        lines.push(
          '',
          `${favorite.amount} ${favorite.fromTokenSymbol} -> ${favorite.toTokenSymbol} (${favorite.chain})`,
          `Текущий net: ${quote.toAmount} ${quote.toSymbol}`,
          `Лучший агрегатор: ${quote.aggregator}`,
          `Алерт: ${alert ? `активен на ${alert.targetToAmount} ${favorite.toTokenSymbol}` : 'нет'}`,
        );
      } catch (error: unknown) {
        lines.push(
          '',
          `${favorite.amount} ${favorite.fromTokenSymbol} -> ${favorite.toTokenSymbol} (${favorite.chain})`,
          `Текущий курс недоступен: ${this.getErrorMessage(error)}`,
          `Алерт: ${alert ? `активен на ${alert.targetToAmount} ${favorite.toTokenSymbol}` : 'нет'}`,
        );
      }

      keyboard.push([
        {
          text: `Проверить ${favorite.fromTokenSymbol}/${favorite.toTokenSymbol}`,
          callback_data: `${FAVORITE_CHECK_PREFIX}${favorite.id}`,
        },
      ]);
      keyboard.push([
        { text: 'Установить алерт', callback_data: `${FAVORITE_ALERT_PREFIX}${favorite.id}` },
        { text: 'Удалить', callback_data: `${FAVORITE_DELETE_PREFIX}${favorite.id}` },
      ]);
    }

    await context.reply(lines.join('\n'), {
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  public async handleHistory(context: Context, userId: string): Promise<void> {
    const items = await this.swapHistoryService.listRecent(userId);

    if (items.length === 0) {
      await context.reply('История обменов пока пуста.');
      return;
    }

    const lines = ['Последние успешные обмены:'];

    for (const item of items) {
      lines.push(
        '',
        `${item.fromAmount} ${item.fromSymbol} -> ${item.toAmount} ${item.toSymbol}`,
        `Сеть: ${item.chain}`,
        `Агрегатор: ${item.aggregator}`,
        `Gross: ${item.grossToAmount} ${item.toSymbol}`,
        `Комиссия бота: ${item.feeAmount} ${item.feeAmountSymbol ?? item.toSymbol}`,
        `Когда: ${item.executedAt ?? 'неизвестно'}`,
        `Tx: ${item.txHash ? this.shortenHash(item.txHash) : 'неизвестно'}`,
      );
    }

    await context.reply(lines.join('\n'));
  }

  public async handleFavoriteAdd(context: Context, userId: string, data: string): Promise<void> {
    const token = data.slice(FAVORITE_ADD_PREFIX.length);
    const action = this.sessionStore.consumePendingAction(userId, token);

    if (!action) {
      await context.answerCbQuery('Действие истекло');
      return;
    }

    const payload = this.getFavoriteActionPayload(action.payload);
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
    await context.reply('Пара добавлена в избранное. Команда: /favorites');
  }

  public async handleFavoriteCheck(context: Context, userId: string, data: string): Promise<void> {
    const favoriteId = data.slice(FAVORITE_CHECK_PREFIX.length);
    await context.answerCbQuery('Обновляю курс...');
    const favorite = await this.favoritesService.getFavorite(userId, favoriteId);

    if (!favorite) {
      await context.reply('Избранная пара не найдена.');
      return;
    }

    const quote = await this.favoritesService.getBestQuoteForFavorite(favorite);
    const alert = await this.priceAlertsService.getActiveAlertForFavorite(favorite.id);

    await context.reply(
      [
        `${favorite.amount} ${favorite.fromTokenSymbol} -> ${favorite.toTokenSymbol}`,
        `Сеть: ${favorite.chain}`,
        `Текущий net: ${quote.toAmount} ${quote.toSymbol}`,
        `Лучший агрегатор: ${quote.aggregator}`,
        `Алерт: ${alert ? `${alert.targetToAmount} ${favorite.toTokenSymbol}` : 'не установлен'}`,
      ].join('\n'),
    );
  }

  public async handleFavoriteAlert(context: Context, userId: string, data: string): Promise<void> {
    const suffix = data.slice(FAVORITE_ALERT_PREFIX.length);
    let favoriteId = suffix;

    if (!this.looksLikeUuid(favoriteId)) {
      const action = this.sessionStore.consumePendingAction(userId, suffix);

      if (!action) {
        await context.answerCbQuery('Действие истекло');
        return;
      }

      const payload = this.getFavoriteActionPayload(action.payload);
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
      token: this.createToken(),
      userId,
      kind: 'alert-threshold',
      payload: { favoriteId },
    });

    await context.answerCbQuery('Жду порог');
    await context.reply(
      'Введи целевое количество to-токена, при котором нужно прислать уведомление.',
    );
  }

  public async handleFavoriteDelete(context: Context, userId: string, data: string): Promise<void> {
    const favoriteId = data.slice(FAVORITE_DELETE_PREFIX.length);
    await context.answerCbQuery('Удаляю...');
    const deleted = await this.favoritesService.deleteFavorite(userId, favoriteId);

    if (!deleted) {
      await context.reply('Избранная пара уже удалена или не найдена.');
      return;
    }

    await context.reply('Избранная пара удалена.');
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
      await context.reply('Ввод порога истёк. Открой /favorites и начни заново.');
      return true;
    }

    try {
      const favoriteIdValue = consumedPending.payload['favoriteId'];
      const favoriteId = typeof favoriteIdValue === 'string' ? favoriteIdValue : '';
      const alert = await this.priceAlertsService.upsertAlert(userId, favoriteId, text);
      const favorite = await this.favoritesService.getFavorite(userId, favoriteId);

      await context.reply(
        favorite
          ? `Алерт установлен: ${alert.targetToAmount} ${favorite.toTokenSymbol} для ${favorite.amount} ${favorite.fromTokenSymbol} -> ${favorite.toTokenSymbol}.`
          : 'Алерт установлен.',
      );
    } catch (error: unknown) {
      this.sessionStore.createPendingAction({
        token: this.createToken(),
        userId,
        kind: 'alert-threshold',
        payload: consumedPending.payload,
      });
      this.logger.error(`Alert threshold failed: ${this.getErrorMessage(error)}`);
      await context.reply(`Ошибка: ${this.getErrorMessage(error)}`);
    }

    return true;
  }

  public isFavoriteAdd(data: string): boolean {
    return data.startsWith(FAVORITE_ADD_PREFIX);
  }

  public isFavoriteCheck(data: string): boolean {
    return data.startsWith(FAVORITE_CHECK_PREFIX);
  }

  public isFavoriteAlert(data: string): boolean {
    return data.startsWith(FAVORITE_ALERT_PREFIX);
  }

  public isFavoriteDelete(data: string): boolean {
    return data.startsWith(FAVORITE_DELETE_PREFIX);
  }

  private createToken(): string {
    return randomBytes(CALLBACK_TOKEN_BYTES).toString('base64url');
  }

  private looksLikeUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  private shortenHash(value: string): string {
    if (value.length <= SHORT_HASH_PREFIX + SHORT_HASH_SUFFIX) {
      return value;
    }

    return `${value.slice(0, SHORT_HASH_PREFIX)}...${value.slice(-SHORT_HASH_SUFFIX)}`;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof BusinessException) {
      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown internal error';
  }

  private getFavoriteActionPayload(payload: Record<string, unknown>): IFavoriteActionPayload {
    const chain = payload['chain'];
    const amount = payload['amount'];
    const fromTokenAddress = payload['fromTokenAddress'];
    const toTokenAddress = payload['toTokenAddress'];

    if (
      typeof chain !== 'string' ||
      typeof amount !== 'string' ||
      typeof fromTokenAddress !== 'string' ||
      typeof toTokenAddress !== 'string'
    ) {
      throw new BusinessException('Данные избранной пары повреждены. Повтори действие.');
    }

    return {
      chain: chain as ChainType,
      amount,
      fromTokenAddress,
      toTokenAddress,
    };
  }
}
