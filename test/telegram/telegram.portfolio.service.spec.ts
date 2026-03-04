import { describe, expect, it, vi } from 'vitest';

import type { IFavoriteActionPayload } from '../../src/telegram/telegram.portfolio.service';
import { TelegramPortfolioService } from '../../src/telegram/telegram.portfolio.service';

describe('TelegramPortfolioService', () => {
  function createService(): {
    service: TelegramPortfolioService;
    parser: {
      isFavoriteAdd: ReturnType<typeof vi.fn>;
      isFavoriteCheck: ReturnType<typeof vi.fn>;
      isFavoriteAlert: ReturnType<typeof vi.fn>;
      isFavoriteDelete: ReturnType<typeof vi.fn>;
    };
    favorites: {
      buildFavoriteActionButtons: ReturnType<typeof vi.fn>;
      handleFavorites: ReturnType<typeof vi.fn>;
      handleFavoriteAdd: ReturnType<typeof vi.fn>;
      handleFavoriteCheck: ReturnType<typeof vi.fn>;
      handleFavoriteDelete: ReturnType<typeof vi.fn>;
    };
    alerts: {
      handleFavoriteAlert: ReturnType<typeof vi.fn>;
      handleAlertThresholdInput: ReturnType<typeof vi.fn>;
    };
    history: {
      handleHistory: ReturnType<typeof vi.fn>;
    };
  } {
    const parser = {
      isFavoriteAdd: vi.fn().mockReturnValue(false),
      isFavoriteCheck: vi.fn().mockReturnValue(false),
      isFavoriteAlert: vi.fn().mockReturnValue(false),
      isFavoriteDelete: vi.fn().mockReturnValue(false),
    };
    const favorites = {
      buildFavoriteActionButtons: vi.fn().mockReturnValue([[{ text: 'x', callback_data: 'y' }]]),
      handleFavorites: vi.fn().mockResolvedValue(undefined),
      handleFavoriteAdd: vi.fn().mockResolvedValue(undefined),
      handleFavoriteCheck: vi.fn().mockResolvedValue(undefined),
      handleFavoriteDelete: vi.fn().mockResolvedValue(undefined),
    };
    const alerts = {
      handleFavoriteAlert: vi.fn().mockResolvedValue(undefined),
      handleAlertThresholdInput: vi.fn().mockResolvedValue(false),
    };
    const history = {
      handleHistory: vi.fn().mockResolvedValue(undefined),
    };

    return {
      service: new TelegramPortfolioService(
        parser as never,
        favorites as never,
        alerts as never,
        history as never,
      ),
      parser,
      favorites,
      alerts,
      history,
    };
  }

  it('должен делегировать buildFavoriteActionButtons в favorites service', () => {
    const { service, favorites } = createService();
    const payload: IFavoriteActionPayload & { userId: string } = {
      userId: '42',
      chain: 'ethereum',
      amount: '1',
      fromTokenAddress: '0xfrom',
      toTokenAddress: '0xto',
    };

    const result = service.buildFavoriteActionButtons(payload);

    expect(favorites.buildFavoriteActionButtons).toHaveBeenCalledWith(payload);
    expect(result).toEqual([[{ text: 'x', callback_data: 'y' }]]);
  });

  it('должен делегировать alert threshold handling в alerts service', async () => {
    const { service, alerts } = createService();
    alerts.handleAlertThresholdInput.mockResolvedValue(true);

    const result = await service.handleAlertThresholdInput({} as never, '42', '200');

    expect(alerts.handleAlertThresholdInput).toHaveBeenCalledWith({} as never, '42', '200');
    expect(result).toBe(true);
  });

  it('должен делегировать predicate проверки parser service', () => {
    const { service, parser } = createService();
    parser.isFavoriteDelete.mockReturnValue(true);

    expect(service.isFavoriteDelete('fav:del:id')).toBe(true);
    expect(parser.isFavoriteDelete).toHaveBeenCalledWith('fav:del:id');
  });
});
