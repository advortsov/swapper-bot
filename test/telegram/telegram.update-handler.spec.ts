import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TelegramCallbackRouterService } from '../../src/telegram/telegram.callback-router.service';
import type { TelegramCommandRouterService } from '../../src/telegram/telegram.command-router.service';
import type { TelegramSettingsHandler } from '../../src/telegram/telegram.settings-handler';
import type { TelegramStartHelpService } from '../../src/telegram/telegram.start-help.service';
import { TelegramUpdateHandler } from '../../src/telegram/telegram.update-handler';

function createSettingsHandler(): TelegramSettingsHandler {
  return {
    register: vi.fn(),
  } as unknown as TelegramSettingsHandler;
}

function createCommandRouter(): TelegramCommandRouterService {
  return {
    handleText: vi.fn(),
    handlePrice: vi.fn(),
    handleSwap: vi.fn(),
    handleApprove: vi.fn(),
    handleConnect: vi.fn(),
    handleDisconnect: vi.fn(),
    handleFavorites: vi.fn(),
    handleHistory: vi.fn(),
  } as unknown as TelegramCommandRouterService;
}

function createCallbackRouter(): TelegramCallbackRouterService {
  return {
    handleAction: vi.fn(),
  } as unknown as TelegramCallbackRouterService;
}

function createStartHelpService(): TelegramStartHelpService {
  return {
    handleStart: vi.fn(),
    handleHelp: vi.fn(),
  } as unknown as TelegramStartHelpService;
}

describe('TelegramUpdateHandler', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('должен регистрировать команды и делегировать их в router-сервисы', async () => {
    const registeredCommands = new Map<string, (context: unknown) => Promise<void>>();
    let actionHandler: ((context: unknown) => Promise<void>) | undefined;
    let textHandler: ((context: unknown) => Promise<void>) | undefined;
    const bot = {
      command: vi.fn((name: string, handler: (context: unknown) => Promise<void>) => {
        registeredCommands.set(name, handler);
      }),
      action: vi.fn((_: RegExp, handler: (context: unknown) => Promise<void>) => {
        actionHandler = handler;
      }),
      on: vi.fn((_: unknown, handler: (context: unknown) => Promise<void>) => {
        textHandler = handler;
      }),
    };
    const settingsHandler = createSettingsHandler();
    const commandRouter = createCommandRouter();
    const callbackRouter = createCallbackRouter();
    const startHelpService = createStartHelpService();
    const handler = new TelegramUpdateHandler(
      settingsHandler,
      commandRouter,
      callbackRouter,
      {} as never,
      startHelpService,
    );

    handler.register(bot as never);

    await registeredCommands.get('start')?.({ reply: vi.fn() });
    await registeredCommands.get('help')?.({ reply: vi.fn() });
    await registeredCommands.get('swap')?.({
      from: { id: 42 },
      message: { text: '/swap 1 ETH to USDC' },
      reply: vi.fn(),
    });
    await registeredCommands.get('approve')?.({
      from: { id: 42 },
      message: { text: '/approve 10 USDC on ethereum' },
      reply: vi.fn(),
    });
    await registeredCommands.get('favorites')?.({ from: { id: 42 }, reply: vi.fn() });
    await registeredCommands.get('history')?.({ from: { id: 42 }, reply: vi.fn() });
    await actionHandler?.({
      from: { id: 42 },
      callbackQuery: { data: 'sw:opaque-token' },
      reply: vi.fn(),
    });
    await textHandler?.({ from: { id: 42 }, message: { text: '205' }, reply: vi.fn() });

    expect(settingsHandler.register).toHaveBeenCalledWith(bot);
    expect(startHelpService.handleStart).toHaveBeenCalledOnce();
    expect(startHelpService.handleHelp).toHaveBeenCalledOnce();
    expect(commandRouter.handleSwap).toHaveBeenCalledOnce();
    expect(commandRouter.handleApprove).toHaveBeenCalledOnce();
    expect(commandRouter.handleFavorites).toHaveBeenCalledOnce();
    expect(commandRouter.handleHistory).toHaveBeenCalledOnce();
    expect(commandRouter.handleText).toHaveBeenCalledOnce();
    expect(callbackRouter.handleAction).toHaveBeenCalledOnce();
  });
});
