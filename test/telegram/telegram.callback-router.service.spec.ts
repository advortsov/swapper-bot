import { afterEach, describe, expect, it, vi } from 'vitest';

import { TelegramCallbackRouterService } from '../../src/telegram/telegram.callback-router.service';

describe('TelegramCallbackRouterService', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('должен маршрутизировать swap callback в trading service', async () => {
    const tradingService = {
      isRiskCallback: vi.fn().mockReturnValue(false),
      isSwapCallback: vi.fn().mockImplementation((data: string) => data.startsWith('sw:')),
      isApproveCallback: vi.fn().mockReturnValue(false),
      isPresetSaveCallback: vi.fn().mockReturnValue(false),
      handleSwapCallback: vi.fn().mockResolvedValue(undefined),
    };
    const service = new TelegramCallbackRouterService(
      tradingService as never,
      {
        isFavoriteAdd: vi.fn().mockReturnValue(false),
        isFavoriteCheck: vi.fn().mockReturnValue(false),
        isFavoriteAlert: vi.fn().mockReturnValue(false),
        isFavoriteDelete: vi.fn().mockReturnValue(false),
      } as never,
      {
        isConnectAction: vi.fn().mockReturnValue(false),
        isDisconnectAction: vi.fn().mockReturnValue(false),
      } as never,
      {
        replyWithError: vi.fn(),
      } as never,
    );

    await service.handleAction({
      from: { id: 42 },
      callbackQuery: { data: 'sw:opaque-token' },
      reply: vi.fn(),
    } as never);

    expect(tradingService.handleSwapCallback).toHaveBeenCalledWith(
      expect.anything(),
      '42',
      'sw:opaque-token',
      expect.anything(),
    );
  });

  it('должен маршрутизировать favorite callback в portfolio service', async () => {
    const portfolioService = {
      isFavoriteAdd: vi.fn().mockImplementation((data: string) => data.startsWith('fav:add:')),
      isFavoriteCheck: vi.fn().mockReturnValue(false),
      isFavoriteAlert: vi.fn().mockReturnValue(false),
      isFavoriteDelete: vi.fn().mockReturnValue(false),
      handleFavoriteAdd: vi.fn().mockResolvedValue(undefined),
    };
    const service = new TelegramCallbackRouterService(
      {
        isRiskCallback: vi.fn().mockReturnValue(false),
        isSwapCallback: vi.fn().mockReturnValue(false),
        isApproveCallback: vi.fn().mockReturnValue(false),
        isPresetSaveCallback: vi.fn().mockReturnValue(false),
      } as never,
      portfolioService as never,
      {
        isConnectAction: vi.fn().mockReturnValue(false),
        isDisconnectAction: vi.fn().mockReturnValue(false),
      } as never,
      {
        replyWithError: vi.fn(),
      } as never,
    );

    await service.handleAction({
      from: { id: 42 },
      callbackQuery: { data: 'fav:add:intent-id' },
      reply: vi.fn(),
    } as never);

    expect(portfolioService.handleFavoriteAdd).toHaveBeenCalledWith(
      expect.anything(),
      '42',
      'fav:add:intent-id',
    );
  });
});
