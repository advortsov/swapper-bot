import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import type { SwapIntentsRepository } from '../../src/database/repositories/swap-intents.repository';
import type { MetricsService } from '../../src/metrics/metrics.service';
import type { SwapExecutionAuditService } from '../../src/swap/swap-execution-audit.service';
import { SwapIntentService } from '../../src/swap/swap-intent.service';

describe('SwapIntentService', () => {
  it('должен создавать execution со статусом initiated до появления session id', async () => {
    const swapExecutionAuditService: Pick<SwapExecutionAuditService, 'createExecution'> = {
      createExecution: vi.fn().mockResolvedValue('execution-id'),
    };
    const service = new SwapIntentService(
      {
        get: vi.fn().mockReturnValue(undefined),
      } as unknown as ConfigService,
      {} as SwapIntentsRepository,
      {} as MetricsService,
      swapExecutionAuditService as SwapExecutionAuditService,
    );

    const executionId = await service.createExecution({
      intentId: 'intent-id',
      userId: 'user-id',
      chain: 'ethereum',
      aggregator: 'paraswap',
      feeMode: 'enforced',
      feeBps: 20,
      feeRecipient: '0x1111111111111111111111111111111111111111',
      grossToAmount: '1000000',
      botFeeAmount: '2000',
      netToAmount: '998000',
      quotePayloadHash: 'quote-hash',
      swapPayloadHash: 'swap-hash',
    });

    expect(executionId).toBe('execution-id');
    expect(swapExecutionAuditService.createExecution).toHaveBeenCalledWith({
      intentId: 'intent-id',
      userId: 'user-id',
      chain: 'ethereum',
      aggregator: 'paraswap',
      feeMode: 'enforced',
      feeBps: 20,
      feeRecipient: '0x1111111111111111111111111111111111111111',
      grossToAmount: '1000000',
      botFeeAmount: '2000',
      netToAmount: '998000',
      quotePayloadHash: 'quote-hash',
      swapPayloadHash: 'swap-hash',
      status: 'initiated',
    });
  });
});
