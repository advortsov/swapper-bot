import type { IZeroXSwapTransaction } from './zero-x.types';
import type { ISwapTransaction } from '../interfaces/aggregator.interface';

export function buildZeroXSwapTransaction(transaction: IZeroXSwapTransaction): ISwapTransaction {
  return {
    kind: 'evm',
    to: transaction.to,
    data: transaction.data,
    value: transaction.value,
  };
}
