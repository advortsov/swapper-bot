import { Module } from '@nestjs/common';

import { TransactionStatusService } from './transaction-status.service';
import { TransactionTrackerService } from './transaction-tracker.service';
import { TransactionTrackerWorker } from './transaction-tracker.worker';
import { ChainsModule } from '../chains/chains.module';

@Module({
  imports: [ChainsModule],
  providers: [TransactionStatusService, TransactionTrackerService, TransactionTrackerWorker],
  exports: [TransactionTrackerService],
})
export class TransactionsModule {}
