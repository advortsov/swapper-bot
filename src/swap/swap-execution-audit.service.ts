import { Injectable } from '@nestjs/common';

import {
  type ICreateSwapExecutionPayload,
  SwapExecutionsRepository,
} from '../database/repositories/swap-executions.repository';
import { SwapIntentsRepository } from '../database/repositories/swap-intents.repository';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class SwapExecutionAuditService {
  public constructor(
    private readonly swapExecutionsRepository: SwapExecutionsRepository,
    private readonly swapIntentsRepository: SwapIntentsRepository,
    private readonly metricsService: MetricsService,
  ) {}

  public async createExecution(payload: ICreateSwapExecutionPayload): Promise<string> {
    const executionId = await this.swapExecutionsRepository.createExecution(payload);
    this.metricsService.incrementSwapRequest('initiated');
    this.metricsService.incrementSwapFeeExecution(payload.aggregator, payload.feeMode, 'initiated');
    return executionId;
  }

  public async markSuccess(
    executionId: string,
    aggregator: string,
    feeMode: string,
    txHash: string,
  ): Promise<void> {
    await this.swapExecutionsRepository.markSuccess(executionId, txHash);
    await this.updateIntentStatus(executionId, 'completed');
    this.metricsService.incrementSwapRequest('success');
    this.metricsService.incrementSwapFeeExecution(aggregator, feeMode, 'success');
  }

  public async markError(
    executionId: string,
    aggregator: string,
    feeMode: string,
    errorMessage: string,
  ): Promise<void> {
    await this.swapExecutionsRepository.markError(executionId, errorMessage);
    await this.updateIntentStatus(executionId, 'failed');
    this.metricsService.incrementSwapRequest('error');
    this.metricsService.incrementSwapFeeExecution(aggregator, feeMode, 'error');
  }

  public async attachProviderReference(
    executionId: string,
    providerReference: string,
  ): Promise<void> {
    await this.swapExecutionsRepository.updateProviderReference(executionId, providerReference);
    await this.updateIntentStatus(executionId, 'session_created');
  }

  private async updateIntentStatus(executionId: string, status: string): Promise<void> {
    const intentId = await this.swapExecutionsRepository.findIntentId(executionId);

    if (!intentId) {
      return;
    }

    await this.swapIntentsRepository.updateStatus(intentId, status);
  }
}
