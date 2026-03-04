import {
  BPS_PERCENT_MULTIPLIER,
  DEFAULT_SLIPPAGE_BPS,
  JUPITER_QUOTE_PATH,
  RESTRICT_INTERMEDIATE_TOKENS,
} from './jupiter.types';
import type { IExecutionFeeConfig } from '../../fees/interfaces/fee-policy.interface';

export function buildJupiterQuoteUrl(input: {
  apiBaseUrl: string;
  inputMint: string;
  outputMint: string;
  amount: string;
  feeConfig: IExecutionFeeConfig;
  slippageBps?: string;
}): URL {
  const url = new URL(JUPITER_QUOTE_PATH, input.apiBaseUrl);
  url.searchParams.set('inputMint', input.inputMint);
  url.searchParams.set('outputMint', input.outputMint);
  url.searchParams.set('amount', input.amount);
  url.searchParams.set('slippageBps', input.slippageBps ?? DEFAULT_SLIPPAGE_BPS);
  url.searchParams.set('restrictIntermediateTokens', RESTRICT_INTERMEDIATE_TOKENS);

  if (input.feeConfig.kind === 'jupiter' && input.feeConfig.mode === 'enforced') {
    url.searchParams.set('platformFeeBps', `${input.feeConfig.feeBps}`);
  }

  return url;
}

export function toJupiterSlippageBps(slippagePercentage: number): string {
  return `${Math.max(Math.round(slippagePercentage * BPS_PERCENT_MULTIPLIER), 1)}`;
}
