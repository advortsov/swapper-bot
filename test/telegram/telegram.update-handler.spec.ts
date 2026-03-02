import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TelegramConnectionsService } from '../../src/telegram/telegram.connections.service';
import type { TelegramPortfolioService } from '../../src/telegram/telegram.portfolio.service';
import type { TelegramSettingsHandler } from '../../src/telegram/telegram.settings-handler';
import type { TelegramTradingService } from '../../src/telegram/telegram.trading.service';
import { TelegramUpdateHandler } from '../../src/telegram/telegram.update-handler';

describe('TelegramUpdateHandler', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('должен регистрировать команды и проксировать /swap в trading service', async () => {
    const registeredCommands = new Map<string, (context: unknown) => Promise<void>>();
    const bot = {
      command: vi.fn((name: string, handler: (context: unknown) => Promise<void>) => {
        registeredCommands.set(name, handler);
      }),
      action: vi.fn(),
      on: vi.fn(),
    };
    const settingsHandler = {
      register: vi.fn(),
      hasPendingInput: vi.fn().mockReturnValue(false),
      handleTextInput: vi.fn(),
    } as unknown as TelegramSettingsHandler;
    const tradingService = {
      handlePrice: vi.fn(),
      handleSwap: vi.fn().mockResolvedValue(undefined),
      isSwapCallback: vi.fn().mockReturnValue(false),
      handleSwapCallback: vi.fn(),
    } as unknown as TelegramTradingService;
    const portfolioService = {
      handleFavorites: vi.fn(),
      handleHistory: vi.fn(),
      handleAlertThresholdInput: vi.fn().mockResolvedValue(false),
      isFavoriteAdd: vi.fn().mockReturnValue(false),
      isFavoriteCheck: vi.fn().mockReturnValue(false),
      isFavoriteAlert: vi.fn().mockReturnValue(false),
      isFavoriteDelete: vi.fn().mockReturnValue(false),
      handleFavoriteAdd: vi.fn(),
      handleFavoriteCheck: vi.fn(),
      handleFavoriteAlert: vi.fn(),
      handleFavoriteDelete: vi.fn(),
    } as unknown as TelegramPortfolioService;
    const connectionsService = {
      handleConnect: vi.fn(),
      handleDisconnect: vi.fn(),
      isConnectAction: vi.fn().mockReturnValue(false),
      isDisconnectAction: vi.fn().mockReturnValue(false),
      handleConnectAction: vi.fn(),
      handleDisconnectAction: vi.fn(),
    } as unknown as TelegramConnectionsService;
    const handler = new TelegramUpdateHandler(
      settingsHandler,
      tradingService,
      portfolioService,
      connectionsService,
    );

    handler.register(bot as never);

    const swapCommandHandler = registeredCommands.get('swap');

    await swapCommandHandler?.({
      from: { id: 42, username: 'tester' },
      message: { text: '/swap 1 SOL to USDC on solana' },
      reply: vi.fn(),
    });

    expect(settingsHandler.register).toHaveBeenCalledWith(bot);
    expect(tradingService.handleSwap).toHaveBeenCalledWith(
      expect.anything(),
      '42',
      'tester',
      '/swap 1 SOL to USDC on solana',
    );
  });

  it('должен маршрутизировать swap callback в trading service', async () => {
    const registeredActions = new Map<string, (context: unknown) => Promise<void>>();
    const bot = {
      command: vi.fn(),
      action: vi.fn((pattern: RegExp, handler: (context: unknown) => Promise<void>) => {
        registeredActions.set(pattern.source, handler);
      }),
      on: vi.fn(),
    };
    const settingsHandler = {
      register: vi.fn(),
      hasPendingInput: vi.fn().mockReturnValue(false),
      handleTextInput: vi.fn(),
    } as unknown as TelegramSettingsHandler;
    const tradingService = {
      handlePrice: vi.fn(),
      handleSwap: vi.fn(),
      isSwapCallback: vi.fn().mockImplementation((data: string) => data.startsWith('sw:')),
      handleSwapCallback: vi.fn().mockResolvedValue(undefined),
    } as unknown as TelegramTradingService;
    const portfolioService = {
      handleFavorites: vi.fn(),
      handleHistory: vi.fn(),
      handleAlertThresholdInput: vi.fn().mockResolvedValue(false),
      isFavoriteAdd: vi.fn().mockReturnValue(false),
      isFavoriteCheck: vi.fn().mockReturnValue(false),
      isFavoriteAlert: vi.fn().mockReturnValue(false),
      isFavoriteDelete: vi.fn().mockReturnValue(false),
      handleFavoriteAdd: vi.fn(),
      handleFavoriteCheck: vi.fn(),
      handleFavoriteAlert: vi.fn(),
      handleFavoriteDelete: vi.fn(),
    } as unknown as TelegramPortfolioService;
    const connectionsService = {
      handleConnect: vi.fn(),
      handleDisconnect: vi.fn(),
      isConnectAction: vi.fn().mockReturnValue(false),
      isDisconnectAction: vi.fn().mockReturnValue(false),
      handleConnectAction: vi.fn(),
      handleDisconnectAction: vi.fn(),
    } as unknown as TelegramConnectionsService;
    const handler = new TelegramUpdateHandler(
      settingsHandler,
      tradingService,
      portfolioService,
      connectionsService,
    );

    handler.register(bot as never);

    const actionHandler = registeredActions.get('.*');

    await actionHandler?.({
      from: { id: 42 },
      callbackQuery: {
        from: { id: 42 },
        data: 'sw:opaque-token',
      },
      answerCbQuery: vi.fn(),
      reply: vi.fn(),
    });

    expect(tradingService.handleSwapCallback).toHaveBeenCalledWith(
      expect.anything(),
      '42',
      'sw:opaque-token',
      connectionsService,
    );
  });
});
