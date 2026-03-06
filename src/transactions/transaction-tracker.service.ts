import { Injectable } from '@nestjs/common';

import type {
  ITrackTransactionRequest,
  ITrackedTransaction,
  TrackedTransactionStatus,
} from './interfaces/transaction-tracker.interface';
import type { ChainType } from '../chains/interfaces/chain.interface';
import { SwapExecutionsRepository } from '../database/repositories/swap-executions.repository';
import type { ITrackedTransactionRecord } from '../database/repositories/tracked-transactions.repository';
import { TrackedTransactionsRepository } from '../database/repositories/tracked-transactions.repository';

@Injectable()
export class TransactionTrackerService {
  public constructor(
    private readonly trackedTransactionsRepository: TrackedTransactionsRepository,
    private readonly swapExecutionsRepository: SwapExecutionsRepository,
  ) {}

  public async track(request: ITrackTransactionRequest): Promise<void> {
    await this.trackedTransactionsRepository.create({
      hash: request.hash,
      chain: request.chain,
      userId: request.userId,
      executionId: request.executionId,
    });

    await this.swapExecutionsRepository.updateTransactionStatus(request.executionId, {
      transactionStatus: 'pending',
    });
  }

  public async getStatus(hash: string): Promise<ITrackedTransaction | null> {
    const record = await this.trackedTransactionsRepository.findByHash(hash);

    if (!record) {
      return null;
    }

    return this.mapRecordToTransaction(record);
  }

  private mapRecordToTransaction(record: ITrackedTransactionRecord): ITrackedTransaction {
    return {
      hash: record.hash,
      chain: record.chain as ChainType,
      userId: record.userId,
      executionId: record.executionId,
      status: record.status as TrackedTransactionStatus,
      submittedAt: record.submittedAt.toISOString(),
      confirmedAt: record.confirmedAt ? record.confirmedAt.toISOString() : null,
      failedAt: record.failedAt ? record.failedAt.toISOString() : null,
      blockNumber: record.blockNumber,
      gasUsed: record.gasUsed,
      effectiveGasPrice: record.effectiveGasPrice,
      errorMessage: record.errorMessage,
    };
  }
}
