import type { ChainType } from '../../chains/interfaces/chain.interface';

export interface ITrackTransactionRequest {
  hash: string;
  chain: ChainType;
  userId: string;
  executionId: string;
}

export type TrackedTransactionStatus = 'pending' | 'confirmed' | 'failed';

export interface ITrackedTransaction {
  hash: string;
  chain: ChainType;
  userId: string;
  executionId: string;
  status: TrackedTransactionStatus;
  submittedAt: string;
  confirmedAt: string | null;
  failedAt: string | null;
  blockNumber: string | null;
  gasUsed: string | null;
  effectiveGasPrice: string | null;
  errorMessage: string | null;
}
