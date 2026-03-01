import { afterEach, describe, expect, it, vi } from 'vitest';

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
  afterEach(() => {
    vi.useRealTimers();
    delete process.env['APP_TIMEZONE'];
  });

  it('должен показывать fee-aware котировки с opaque callback token при /swap', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-27T23:55:00.000Z'));
    process.env['APP_TIMEZONE'] = 'Europe/Volgograd';

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
        intentId: 'intent-id',
        chain: 'solana',
        aggregator: 'jupiter',
        fromSymbol: 'SOL',
        toSymbol: 'USDC',
        fromAmount: '1',
        toAmount: '149.7',
        grossToAmount: '150',
        feeAmount: '0.3',
        feeAmountSymbol: 'USDC',
        feeBps: 20,
        feeMode: 'enforced',
        feeType: 'native fee',
        feeDisplayLabel: 'native fee',
        providersPolled: 1,
        quoteExpiresAt: '2026-02-28T00:00:00.000Z',
        providerQuotes: [
          {
            aggregator: 'jupiter',
            toAmount: '149.7',
            grossToAmount: '150',
            feeAmount: '0.3',
            feeAmountSymbol: 'USDC',
            feeBps: 20,
            feeMode: 'enforced',
            feeType: 'native fee',
            feeDisplayLabel: 'native fee',
            feeAppliedAtQuote: true,
            feeEnforcedOnExecution: true,
            estimatedGasUsd: null,
            selectionToken: 'opaque-token',
          },
        ],
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

    const replyArgs = reply.mock.calls[0] as [
      string,
      { reply_markup: { inline_keyboard: { text: string; callback_data: string }[][] } },
    ];
    const messageText = replyArgs[0];
    const firstButton = replyArgs[1].reply_markup.inline_keyboard[0]?.[0];

    expect(messageText).toContain('Комиссия бота: 0.3 USDC');
    expect(messageText).toContain('Срок актуальности свопа: 5 мин');
    expect(messageText).toContain('Доступные котировки:');
    expect(messageText).toContain('- jupiter: gross 150 USDC');
    expect(firstButton?.text).toContain('native fee: 0.3 USDC');
    expect(firstButton?.callback_data).toBe('sw:opaque-token');
  });

  it('должен создавать WC-сессию из opaque token и отправлять QR + кнопку Phantom', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-27T23:55:00.000Z'));
    process.env['APP_TIMEZONE'] = 'Europe/Volgograd';

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
    const swapService = {
      getSwapQuotes: vi.fn().mockResolvedValue({
        intentId: 'intent-id',
        chain: 'solana',
        aggregator: 'jupiter',
        fromSymbol: 'SOL',
        toSymbol: 'USDC',
        fromAmount: '1',
        toAmount: '149.7',
        grossToAmount: '150',
        feeAmount: '0.3',
        feeAmountSymbol: 'USDC',
        feeBps: 20,
        feeMode: 'enforced',
        feeType: 'native fee',
        feeDisplayLabel: 'native fee',
        providersPolled: 1,
        quoteExpiresAt: '2026-02-28T00:00:00.000Z',
        providerQuotes: [
          {
            aggregator: 'jupiter',
            toAmount: '149.7',
            grossToAmount: '150',
            feeAmount: '0.3',
            feeAmountSymbol: 'USDC',
            feeBps: 20,
            feeMode: 'enforced',
            feeType: 'native fee',
            feeDisplayLabel: 'native fee',
            feeAppliedAtQuote: true,
            feeEnforcedOnExecution: true,
            estimatedGasUsd: null,
            selectionToken: 'opaque-token',
          },
        ],
      }),
      createSwapSessionFromSelection: vi.fn().mockResolvedValue({
        intentId: 'intent-id',
        chain: 'solana',
        aggregator: 'jupiter',
        fromSymbol: 'SOL',
        toSymbol: 'USDC',
        fromAmount: '1',
        toAmount: '149.7',
        grossToAmount: '150',
        feeAmount: '0.3',
        feeAmountSymbol: 'USDC',
        feeBps: 20,
        feeMode: 'enforced',
        feeType: 'native fee',
        feeDisplayLabel: 'native fee',
        walletConnectUri: 'https://example.org/phantom/connect?sessionId=session-id',
        sessionId: 'session-id',
        expiresAt: '2026-02-28T00:00:00.000Z',
        quoteExpiresAt: '2026-02-28T00:00:00.000Z',
      }),
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

    const swapCommandHandler = registeredCommands.get('swap');
    const swapReply = vi.fn().mockResolvedValue(undefined);
    await swapCommandHandler?.({
      from: { id: 42, username: 'tester' },
      message: { text: '/swap 1 SOL to USDC on solana' },
      reply: swapReply,
    });

    const replyCall = swapReply.mock.calls[0] as [
      string,
      { reply_markup: { inline_keyboard: { callback_data: string }[][] } },
    ];
    const callbackData = replyCall[1].reply_markup.inline_keyboard[0]?.[0]?.callback_data;
    const actionHandler = registeredActions.get('^sw:');
    const callbackReply = vi.fn().mockResolvedValue(undefined);
    const replyWithPhoto = vi.fn().mockResolvedValue(undefined);
    const answerCbQuery = vi.fn().mockResolvedValue(undefined);

    await actionHandler?.({
      from: { id: 42 },
      callbackQuery: {
        from: { id: 42 },
        data: callbackData,
      },
      reply: callbackReply,
      replyWithPhoto,
      answerCbQuery,
    });

    expect(swapService.createSwapSessionFromSelection).toHaveBeenCalledWith('42', 'opaque-token');

    const callbackReplyArgs = callbackReply.mock.calls[0] as [
      string,
      { reply_markup: { inline_keyboard: { text: string; url: string }[][] } },
    ];
    const callbackText = callbackReplyArgs[0];

    expect(callbackText).toContain('Выбранный агрегатор: jupiter');
    expect(callbackText).toContain('Комиссия бота: 0.3 USDC');
    expect(callbackText).toContain('Сессия истекает: 28.02.2026 03:00');
    expect(callbackText).toContain('Котировка актуальна до: 28.02.2026 03:00');
    expect(replyWithPhoto).toHaveBeenCalledTimes(1);
  });
});
