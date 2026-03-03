import { describe, expect, it, vi } from 'vitest';

import type { IApproveSessionResponse } from '../../src/allowance/interfaces/allowance.interface';
import type { ISwapSessionResponse } from '../../src/swap/interfaces/swap.interface';
import { TelegramConnectionsService } from '../../src/telegram/telegram.connections.service';

describe('TelegramConnectionsService', () => {
  it('должен возвращать кнопки открытия кошельков для evm swap session', async () => {
    const service = new TelegramConnectionsService({
      getConnectionStatus: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    } as never);
    const reply = vi.fn().mockResolvedValue(undefined);
    const replyWithPhoto = vi.fn().mockResolvedValue(undefined);
    const context = {
      reply,
      replyWithPhoto,
    };
    const session: ISwapSessionResponse = {
      intentId: 'intent-1',
      chain: 'ethereum',
      aggregator: 'paraswap',
      fromSymbol: 'ETH',
      toSymbol: 'USDC',
      fromAmount: '0.1',
      toAmount: '198.42',
      grossToAmount: '198.72',
      feeAmount: '0.30',
      feeAmountSymbol: 'USDC',
      feeBps: 20,
      feeMode: 'enforced',
      feeType: 'partner fee',
      feeDisplayLabel: 'partner fee',
      walletConnectUri: 'wc:test-session@2?relay-protocol=irn&symKey=test',
      sessionId: 'session-id',
      expiresAt: '2026-03-03T12:10:00.000Z',
      quoteExpiresAt: '2026-03-03T12:05:00.000Z',
      walletDelivery: 'qr',
    };

    await service.replySwapSession(context as never, session);

    const replyOptions = reply.mock.calls[0]?.[1] as
      | {
          reply_markup?: {
            inline_keyboard?: { text: string; url?: string }[][];
          };
        }
      | undefined;

    expect(reply).toHaveBeenCalledTimes(1);
    expect(replyOptions?.reply_markup?.inline_keyboard?.[0]?.map((button) => button.text)).toEqual([
      'Open in MetaMask',
      'Open in Trust Wallet',
    ]);
    expect(replyOptions?.reply_markup?.inline_keyboard?.[1]?.[0]?.text).toBe(
      'MetaMask (legacy link)',
    );
    expect(replyWithPhoto).toHaveBeenCalledTimes(1);
  });

  it('должен возвращать кнопки открытия кошельков для approve session', async () => {
    const service = new TelegramConnectionsService({
      getConnectionStatus: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    } as never);
    const reply = vi.fn().mockResolvedValue(undefined);
    const replyWithPhoto = vi.fn().mockResolvedValue(undefined);
    const context = {
      reply,
      replyWithPhoto,
    };
    const session: IApproveSessionResponse = {
      chain: 'arbitrum',
      tokenSymbol: 'USDC',
      tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      aggregatorName: 'paraswap',
      spenderAddress: '0x1111111111111111111111111111111111111111',
      mode: 'exact',
      amount: '100',
      currentAllowance: '12.5',
      walletConnectUri: 'wc:test-session@2?relay-protocol=irn&symKey=test',
      sessionId: 'session-id',
      expiresAt: '2026-03-03T12:10:00.000Z',
      walletDelivery: 'qr',
    };

    await service.replyApproveSession(context as never, session);

    const replyOptions = reply.mock.calls[0]?.[1] as
      | {
          reply_markup?: {
            inline_keyboard?: { text: string; url?: string }[][];
          };
        }
      | undefined;

    expect(reply).toHaveBeenCalledTimes(1);
    expect(replyOptions?.reply_markup?.inline_keyboard?.[0]?.map((button) => button.text)).toEqual([
      'Open in MetaMask',
      'Open in Trust Wallet',
    ]);
    expect(replyOptions?.reply_markup?.inline_keyboard?.[1]?.[0]?.text).toBe(
      'MetaMask (legacy link)',
    );
    expect(replyWithPhoto).toHaveBeenCalledTimes(1);
  });
});
