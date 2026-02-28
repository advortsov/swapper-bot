import { describe, expect, it, vi } from 'vitest';

import type { UsersRepository } from '../../src/database/repositories/users.repository';
import type { PriceService } from '../../src/price/price.service';
import type { SwapService } from '../../src/swap/swap.service';
import type { TelegramSettingsHandler } from '../../src/telegram/telegram.settings-handler';
import { TelegramUpdateHandler } from '../../src/telegram/telegram.update-handler';

const settingsHandler = {
  register: vi.fn(),
  hasPendingInput: vi.fn().mockReturnValue(false),
  handleTextInput: vi.fn(),
} as unknown as TelegramSettingsHandler;

describe('TelegramUpdateHandler', () => {
  it('должен показывать котировки с кнопками выбора агрегатора при /swap', async () => {
    const registeredCommands = new Map<string, (context: unknown) => Promise<void>>();
    const bot = {
      command: vi.fn((name: string, handler: (context: unknown) => Promise<void>) => {
        registeredCommands.set(name, handler);
      }),
      action: vi.fn(),
      on: vi.fn(),
    };
    const swapService: Pick<SwapService, 'getSwapQuotes'> = {
      getSwapQuotes: vi.fn().mockResolvedValue({
        chain: 'solana',
        aggregator: 'jupiter',
        fromSymbol: 'SOL',
        toSymbol: 'USDC',
        fromAmount: '1',
        toAmount: '150',
        providersPolled: 1,
        providerQuotes: [{ aggregator: 'jupiter', toAmount: '150', estimatedGasUsd: null }],
      }),
    };
    const usersRepository: Pick<UsersRepository, 'upsertUser'> = {
      upsertUser: vi.fn().mockResolvedValue(undefined),
    };
    const handler = new TelegramUpdateHandler(
      {} as PriceService,
      swapService as SwapService,
      usersRepository as UsersRepository,
      settingsHandler,
    );

    handler.register(bot as never);

    const swapCommandHandler = registeredCommands.get('swap');

    expect(swapCommandHandler).toBeTypeOf('function');

    const reply = vi.fn().mockResolvedValue(undefined);
    await swapCommandHandler?.({
      from: {
        id: 42,
        username: 'tester',
      },
      message: {
        text: '/swap 1 SOL to USDC on solana',
      },
      reply,
    });

    expect(reply).toHaveBeenCalledTimes(1);

    const replyArgs = reply.mock.calls[0] as [
      string,
      { reply_markup: { inline_keyboard: { text: string; callback_data: string }[][] } },
    ];
    const messageText: string = replyArgs[0];
    const keyboard = replyArgs[1].reply_markup.inline_keyboard;
    const firstButton = keyboard[0]?.[0];

    expect(messageText).toContain('Выбери агрегатор для свопа:');
    expect(keyboard).toHaveLength(1);
    expect(firstButton).toBeDefined();
    expect(firstButton?.text).toContain('jupiter');
    expect(firstButton?.callback_data).toMatch(/^sw:42_\d+:jupiter$/);
  });

  it('должен создавать WC-сессию и отправлять QR + кнопку Phantom для Solana', async () => {
    const registeredCommands = new Map<string, (context: unknown) => Promise<void>>();
    const registeredActions = new Map<string, (context: unknown) => Promise<void>>();
    const bot = {
      command: vi.fn((name: string, handler: (context: unknown) => Promise<void>) => {
        registeredCommands.set(name, handler);
      }),
      action: vi.fn((pattern: RegExp, handler: (context: unknown) => Promise<void>) => {
        registeredActions.set(pattern.source, handler);
      }),
      on: vi.fn(),
    };
    const getSwapQuotesMock = vi.fn().mockResolvedValue({
      chain: 'solana',
      aggregator: 'jupiter',
      fromSymbol: 'SOL',
      toSymbol: 'USDC',
      fromAmount: '1',
      toAmount: '150',
      providersPolled: 1,
      providerQuotes: [{ aggregator: 'jupiter', toAmount: '150', estimatedGasUsd: null }],
    });
    const createSwapSessionMock = vi.fn().mockResolvedValue({
      chain: 'solana',
      walletConnectUri: 'https://example.org/phantom/connect?sessionId=session-id',
      sessionId: 'session-id',
      expiresAt: '2026-02-28T00:00:00.000Z',
    });
    const swapService = {
      getSwapQuotes: getSwapQuotesMock,
      createSwapSession: createSwapSessionMock,
    };
    const usersRepository: Pick<UsersRepository, 'upsertUser'> = {
      upsertUser: vi.fn().mockResolvedValue(undefined),
    };
    const handler = new TelegramUpdateHandler(
      {} as PriceService,
      swapService as unknown as SwapService,
      usersRepository as UsersRepository,
      settingsHandler,
    );

    handler.register(bot as never);

    // Step 1: /swap command — shows quotes with buttons
    const swapCommandHandler = registeredCommands.get('swap');
    const swapReply = vi.fn().mockResolvedValue(undefined);
    await swapCommandHandler?.({
      from: { id: 42, username: 'tester' },
      message: { text: '/swap 1 SOL to USDC on solana' },
      reply: swapReply,
    });

    // Extract the callback_data from the reply to simulate button tap
    const replyCall = swapReply.mock.calls[0] as [
      string,
      { reply_markup: { inline_keyboard: { callback_data: string }[][] } },
    ];
    const callbackData = replyCall[1].reply_markup.inline_keyboard[0]?.[0]?.callback_data;

    expect(callbackData).toBeDefined();

    // Step 2: User taps the aggregator button
    const actionHandler = registeredActions.get('^sw:');

    expect(actionHandler).toBeTypeOf('function');

    const callbackReply = vi.fn().mockResolvedValue(undefined);
    const replyWithPhoto = vi.fn().mockResolvedValue(undefined);
    const answerCbQuery = vi.fn().mockResolvedValue(undefined);
    await actionHandler?.({
      callbackQuery: {
        from: { id: 42 },
        data: callbackData,
      },
      reply: callbackReply,
      replyWithPhoto,
      answerCbQuery,
    });

    expect(createSwapSessionMock).toHaveBeenCalledTimes(1);
    expect(createSwapSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        chain: 'solana',
        userId: '42',
        amount: '1',
        fromSymbol: 'SOL',
        toSymbol: 'USDC',
      }),
      'jupiter',
    );

    // Solana: reply with Phantom button + QR
    expect(callbackReply).toHaveBeenCalledWith(expect.stringContaining('Phantom'), {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Open in Phantom',
              url: 'https://example.org/phantom/connect?sessionId=session-id',
            },
          ],
        ],
      },
    });
    expect(replyWithPhoto).toHaveBeenCalledTimes(1);
  });
});
