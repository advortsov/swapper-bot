import { afterEach, describe, expect, it, vi } from 'vitest';

import { TelegramCommandRouterService } from '../../src/telegram/telegram.command-router.service';

function createContext(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    from: { id: 42, username: 'tester' },
    message: { text: '/swap 1 ETH to USDC' },
    reply: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('TelegramCommandRouterService', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('должен передавать pending text input в settings handler', async () => {
    const settingsHandler = {
      hasPendingInput: vi.fn().mockReturnValue(true),
      handleTextInput: vi.fn().mockResolvedValue(undefined),
    };
    const service = new TelegramCommandRouterService(
      settingsHandler as never,
      {} as never,
      {} as never,
      {} as never,
    );
    Object.assign(service, {
      errorReplyService: {} as never,
      transactionTrackerService: {} as never,
      portfolioBalanceService: {} as never,
      templatesService: {} as never,
    });

    await service.handleText(createContext() as never);

    expect(settingsHandler.handleTextInput).toHaveBeenCalledOnce();
  });

  it('должен маршрутизировать /swap в trading service', async () => {
    const tradingService = {
      handleSwap: vi.fn().mockResolvedValue(undefined),
    };
    const service = new TelegramCommandRouterService(
      {
        hasPendingInput: vi.fn().mockReturnValue(false),
      } as never,
      tradingService as never,
      {
        handleAlertThresholdInput: vi.fn(),
      } as never,
      {} as never,
    );
    Object.assign(service, {
      errorReplyService: {
        replyWithError: vi.fn(),
      } as never,
      portfolioBalanceService: {} as never,
      templatesService: {} as never,
    });

    await service.handleSwap(createContext() as never);

    expect(tradingService.handleSwap).toHaveBeenCalledWith(
      expect.anything(),
      '42',
      'tester',
      '/swap 1 ETH to USDC',
    );
  });
});
