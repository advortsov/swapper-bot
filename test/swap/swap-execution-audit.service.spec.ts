import { describe, expect, it, vi } from 'vitest';

import type { SwapExecutionsRepository } from '../../src/database/repositories/swap-executions.repository';
import type { SwapIntentsRepository } from '../../src/database/repositories/swap-intents.repository';
import type { MetricsService } from '../../src/metrics/metrics.service';
import { SwapExecutionAuditService } from '../../src/swap/swap-execution-audit.service';

describe('SwapExecutionAuditService', () => {
  it('должен переводить intent в session_created после сохранения provider reference', async () => {
    const swapExecutionsRepository: Pick<
      SwapExecutionsRepository,
      'updateProviderReference' | 'findIntentId'
    > = {
      updateProviderReference: vi.fn().mockResolvedValue(undefined),
      findIntentId: vi.fn().mockResolvedValue('intent-1'),
    };
    const swapIntentsRepository: Pick<SwapIntentsRepository, 'updateStatus'> = {
      updateStatus: vi.fn().mockResolvedValue(undefined),
    };
    const metricsService: Pick<
      MetricsService,
      'incrementSwapRequest' | 'incrementSwapFeeExecution'
    > = {
      incrementSwapRequest: vi.fn(),
      incrementSwapFeeExecution: vi.fn(),
    };
    const service = new SwapExecutionAuditService(
      swapExecutionsRepository as SwapExecutionsRepository,
      swapIntentsRepository as SwapIntentsRepository,
      metricsService as MetricsService,
    );

    await service.attachProviderReference('execution-1', 'session-1');

    expect(swapExecutionsRepository.updateProviderReference).toHaveBeenCalledWith(
      'execution-1',
      'session-1',
    );
    expect(swapIntentsRepository.updateStatus).toHaveBeenCalledWith('intent-1', 'session_created');
  });

  it('должен переводить intent в completed после успешного свопа', async () => {
    const swapExecutionsRepository: Pick<SwapExecutionsRepository, 'markSuccess' | 'findIntentId'> =
      {
        markSuccess: vi.fn().mockResolvedValue(undefined),
        findIntentId: vi.fn().mockResolvedValue('intent-1'),
      };
    const swapIntentsRepository: Pick<SwapIntentsRepository, 'updateStatus'> = {
      updateStatus: vi.fn().mockResolvedValue(undefined),
    };
    const metricsService: Pick<
      MetricsService,
      'incrementSwapRequest' | 'incrementSwapFeeExecution'
    > = {
      incrementSwapRequest: vi.fn(),
      incrementSwapFeeExecution: vi.fn(),
    };
    const service = new SwapExecutionAuditService(
      swapExecutionsRepository as SwapExecutionsRepository,
      swapIntentsRepository as SwapIntentsRepository,
      metricsService as MetricsService,
    );

    await service.markSuccess('execution-1', 'paraswap', 'enforced', '0xhash');

    expect(swapExecutionsRepository.markSuccess).toHaveBeenCalledWith('execution-1', '0xhash');
    expect(swapIntentsRepository.updateStatus).toHaveBeenCalledWith('intent-1', 'completed');
    expect(metricsService.incrementSwapRequest).toHaveBeenCalledWith('success');
  });

  it('должен переводить intent в failed после ошибки свопа', async () => {
    const swapExecutionsRepository: Pick<SwapExecutionsRepository, 'markError' | 'findIntentId'> = {
      markError: vi.fn().mockResolvedValue(undefined),
      findIntentId: vi.fn().mockResolvedValue('intent-1'),
    };
    const swapIntentsRepository: Pick<SwapIntentsRepository, 'updateStatus'> = {
      updateStatus: vi.fn().mockResolvedValue(undefined),
    };
    const metricsService: Pick<
      MetricsService,
      'incrementSwapRequest' | 'incrementSwapFeeExecution'
    > = {
      incrementSwapRequest: vi.fn(),
      incrementSwapFeeExecution: vi.fn(),
    };
    const service = new SwapExecutionAuditService(
      swapExecutionsRepository as SwapExecutionsRepository,
      swapIntentsRepository as SwapIntentsRepository,
      metricsService as MetricsService,
    );

    await service.markError('execution-1', 'paraswap', 'enforced', 'failed');

    expect(swapExecutionsRepository.markError).toHaveBeenCalledWith('execution-1', 'failed');
    expect(swapIntentsRepository.updateStatus).toHaveBeenCalledWith('intent-1', 'failed');
    expect(metricsService.incrementSwapRequest).toHaveBeenCalledWith('error');
  });
});
