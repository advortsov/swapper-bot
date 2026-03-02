import { describe, expect, it, vi } from 'vitest';

import { SwapHistoryService } from '../../src/history/swap-history.service';

describe('SwapHistoryService', () => {
  it('должен возвращать только успешные свопы в display-формате', async () => {
    const rows = [
      {
        executionId: 'exec-1',
        chain: 'ethereum',
        aggregator: 'paraswap',
        grossToAmount: '200000000',
        botFeeAmount: '100000',
        netToAmount: '199900000',
        txHash: '0x1234567890abcdef',
        executedAt: new Date('2026-03-03T10:00:00.000Z'),
        quoteSnapshot: {
          normalizedAmount: '0.1',
          fromToken: { symbol: 'ETH' },
          toToken: { symbol: 'USDC', decimals: 6 },
          providerQuotes: [
            {
              aggregatorName: 'paraswap',
              feeAmountSymbol: 'USDC',
              feeAmountDecimals: 6,
            },
          ],
        },
      },
    ];
    const connection = {
      selectFrom: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue(rows),
    };
    const service = new SwapHistoryService({
      getConnection: vi.fn().mockReturnValue(connection),
    } as never);

    const result = await service.listRecent('42');

    expect(result[0]?.aggregator).toBe('paraswap');
    expect(result[0]?.toAmount).toBe('199.9');
    expect(result[0]?.feeAmount).toBe('0.1');
  });
});
