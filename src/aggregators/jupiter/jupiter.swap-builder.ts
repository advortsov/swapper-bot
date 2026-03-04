import type { IJupiterQuoteResponse, IJupiterSwapResponse } from './jupiter.response-mapper';
import { JUPITER_SWAP_PATH } from './jupiter.types';
import type { IExecutionFeeConfig } from '../../fees/interfaces/fee-policy.interface';
import type { ISwapTransaction } from '../interfaces/aggregator.interface';

export function buildJupiterSwapUrl(apiBaseUrl: string): URL {
  return new URL(JUPITER_SWAP_PATH, apiBaseUrl);
}

export function buildJupiterSwapRequest(input: {
  quoteResponse: IJupiterQuoteResponse;
  userPublicKey: string;
  feeConfig: IExecutionFeeConfig;
  feeAccount?: string;
}): Record<string, unknown> {
  return {
    quoteResponse: input.quoteResponse,
    userPublicKey: input.userPublicKey,
    dynamicComputeUnitLimit: true,
    dynamicSlippage: true,
    feeAccount: input.feeAccount,
  };
}

export function buildJupiterSwapTransaction(response: IJupiterSwapResponse): ISwapTransaction {
  return {
    kind: 'solana',
    to: '',
    data: '',
    value: '0',
    serializedTransaction: response.swapTransaction,
    lastValidBlockHeight: response.lastValidBlockHeight,
  };
}
