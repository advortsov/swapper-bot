import { describe, expect, it, vi } from 'vitest';

import { TelegramTradingService } from '../../src/telegram/telegram.trading.service';

describe('TelegramTradingService', () => {
  function createService(): {
    service: TelegramTradingService;
    usersRepository: { upsertUser: ReturnType<typeof vi.fn> };
    parser: {
      parsePriceCommand: ReturnType<typeof vi.fn>;
      parseSwapCommand: ReturnType<typeof vi.fn>;
      parseApproveCommand: ReturnType<typeof vi.fn>;
      parseSwapSelectionToken: ReturnType<typeof vi.fn>;
      parseApproveCallback: ReturnType<typeof vi.fn>;
      isSwapCallback: ReturnType<typeof vi.fn>;
      isApproveCallback: ReturnType<typeof vi.fn>;
    };
    quote: {
      handlePrice: ReturnType<typeof vi.fn>;
      handleSwap: ReturnType<typeof vi.fn>;
      handleSwapCallback: ReturnType<typeof vi.fn>;
    };
    approve: {
      handleApprove: ReturnType<typeof vi.fn>;
      handleApproveCallback: ReturnType<typeof vi.fn>;
    };
  } {
    const usersRepository = {
      upsertUser: vi.fn().mockResolvedValue(undefined),
    };
    const parser = {
      parsePriceCommand: vi.fn(),
      parseSwapCommand: vi.fn(),
      parseApproveCommand: vi.fn(),
      parseSwapSelectionToken: vi.fn(),
      parseApproveCallback: vi.fn(),
      isSwapCallback: vi.fn().mockReturnValue(false),
      isApproveCallback: vi.fn().mockReturnValue(false),
    };
    const quote = {
      handlePrice: vi.fn().mockResolvedValue(undefined),
      handleSwap: vi.fn().mockResolvedValue(undefined),
      handleSwapCallback: vi.fn().mockResolvedValue(undefined),
    };
    const approve = {
      handleApprove: vi.fn().mockResolvedValue(undefined),
      handleApproveCallback: vi.fn().mockResolvedValue(undefined),
    };
    const service = new TelegramTradingService(
      usersRepository as never,
      parser as never,
      quote as never,
      approve as never,
    );

    return {
      service,
      usersRepository,
      parser,
      quote,
      approve,
    };
  }

  it('должен делегировать /price в parser и quote service', async () => {
    const { service, usersRepository, parser, quote } = createService();
    const context = {};
    parser.parsePriceCommand.mockReturnValue({ chain: 'ethereum' });

    await service.handlePrice(context as never, '42', 'tester', '/price 1 ETH to USDC');

    expect(usersRepository.upsertUser).toHaveBeenCalledWith({ id: '42', username: 'tester' });
    expect(quote.handlePrice).toHaveBeenCalledWith(
      context,
      '42',
      '/price 1 ETH to USDC',
      expect.objectContaining({ chain: 'ethereum' }),
    );
  });

  it('должен отвечать неверными данными на битый swap callback', async () => {
    const { service, parser, quote } = createService();
    const answerCbQuery = vi.fn().mockResolvedValue(undefined);
    parser.parseSwapSelectionToken.mockImplementation(() => {
      throw new Error('broken');
    });

    await service.handleSwapCallback({ answerCbQuery } as never, '42', 'sw:', {} as never);

    expect(answerCbQuery).toHaveBeenCalledWith('Неверные данные');
    expect(quote.handleSwapCallback).not.toHaveBeenCalled();
  });
});
