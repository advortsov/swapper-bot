import type { ChainType } from '../chains/interfaces/chain.interface';

export interface ISwapHistoryItem {
  executionId: string;
  executedAt: string | null;
  chain: ChainType;
  aggregator: string;
  fromAmount: string;
  fromSymbol: string;
  toAmount: string;
  toSymbol: string;
  grossToAmount: string;
  feeAmount: string;
  feeAmountSymbol: string | null;
  txHash: string | null;
  transactionStatus: string | null;
  confirmedAt: string | null;
  gasUsed: string | null;
  effectiveGasPrice: string | null;
  explorerUrl: string | null;
}
