import { describe, expect, it, vi } from 'vitest';

import type { UsersRepository } from '../../src/database/repositories/users.repository';
import type { PriceService } from '../../src/price/price.service';
import type { SwapService } from '../../src/swap/swap.service';
import { TelegramUpdateHandler } from '../../src/telegram/telegram.update-handler';

describe('TelegramUpdateHandler', () => {
  it('должен отправлять для solana swap ссылку на Phantom и кнопку открытия', async () => {
    const registeredCommands = new Map<string, (context: unknown) => Promise<void>>();
    const bot = {
      command: vi.fn((name: string, handler: (context: unknown) => Promise<void>) => {
        registeredCommands.set(name, handler);
      }),
    };
    const swapService: Pick<SwapService, 'createSwapSession'> = {
      createSwapSession: vi.fn().mockResolvedValue({
        chain: 'solana',
        aggregator: 'jupiter',
        fromSymbol: 'SOL',
        toSymbol: 'USDC',
        fromAmount: '1',
        toAmount: '150',
        providersPolled: 1,
        providerQuotes: [{ aggregator: 'jupiter', toAmount: '150', estimatedGasUsd: null }],
        walletConnectUri: 'https://example.org/phantom/connect?sessionId=session-id',
        sessionId: 'session-id',
        expiresAt: '2026-02-28T00:00:00.000Z',
      }),
    };
    const usersRepository: Pick<UsersRepository, 'upsertUser'> = {
      upsertUser: vi.fn().mockResolvedValue(undefined),
    };
    const handler = new TelegramUpdateHandler(
      {} as PriceService,
      swapService as SwapService,
      usersRepository as UsersRepository,
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
    expect(reply).toHaveBeenCalledWith(
      expect.stringContaining('Открой ссылку ниже в Phantom для подключения и подписи транзакции.'),
      {
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
      },
    );
  });
});
