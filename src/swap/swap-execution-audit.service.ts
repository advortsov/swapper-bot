import { Injectable } from '@nestjs/common';

import {
  type ICreateSwapExecutionPayload,
  SwapExecutionsRepository,
} from '../database/repositories/swap-executions.repository';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class SwapExecutionAuditService {
  public constructor(
    private readonly swapExecutionsRepository: SwapExecutionsRepository,
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
    this.metricsService.incrementSwapRequest('error');
    this.metricsService.incrementSwapFeeExecution(aggregator, feeMode, 'error');
  }

  public async attachProviderReference(
    executionId: string,
    providerReference: string,
  ): Promise<void> {
    await this.swapExecutionsRepository.updateProviderReference(executionId, providerReference);
  }
}
