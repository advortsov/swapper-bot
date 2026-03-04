import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

import type { IFavoriteActionPayload } from './telegram.portfolio.service';
import type { ChainType } from '../chains/interfaces/chain.interface';
import { BusinessException } from '../common/exceptions/business.exception';

const FAVORITE_ADD_PREFIX = 'fav:add:';
const FAVORITE_CHECK_PREFIX = 'fav:check:';
const FAVORITE_ALERT_PREFIX = 'fav:alert:';
const FAVORITE_DELETE_PREFIX = 'fav:del:';
const CALLBACK_TOKEN_BYTES = 9;

@Injectable()
export class TelegramPortfolioParserService {
  public createToken(): string {
    return randomBytes(CALLBACK_TOKEN_BYTES).toString('base64url');
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

  public getFavoriteAddToken(data: string): string {
    return data.slice(FAVORITE_ADD_PREFIX.length);
  }

  public getFavoriteCheckId(data: string): string {
    return data.slice(FAVORITE_CHECK_PREFIX.length);
  }

  public getFavoriteAlertSuffix(data: string): string {
    return data.slice(FAVORITE_ALERT_PREFIX.length);
  }

  public getFavoriteDeleteId(data: string): string {
    return data.slice(FAVORITE_DELETE_PREFIX.length);
  }

  public buildFavoriteAddCallbackData(token: string): string {
    return `${FAVORITE_ADD_PREFIX}${token}`;
  }

  public buildFavoriteAlertCallbackData(tokenOrId: string): string {
    return `${FAVORITE_ALERT_PREFIX}${tokenOrId}`;
  }

  public buildFavoriteCheckCallbackData(favoriteId: string): string {
    return `${FAVORITE_CHECK_PREFIX}${favoriteId}`;
  }

  public buildFavoriteDeleteCallbackData(favoriteId: string): string {
    return `${FAVORITE_DELETE_PREFIX}${favoriteId}`;
  }

  public looksLikeUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  public getErrorMessage(error: unknown): string {
    if (error instanceof BusinessException) {
      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown internal error';
  }

  public getFavoriteActionPayload(payload: Record<string, unknown>): IFavoriteActionPayload {
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
