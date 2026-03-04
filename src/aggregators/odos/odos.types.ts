import type { ChainType } from '../../chains/interfaces/chain.interface';

export const DEFAULT_ODOS_API_BASE_URL = 'https://api.odos.xyz';
export const QUOTE_ENDPOINT_PATH = '/sor/quote/v2';
export const ASSEMBLE_ENDPOINT_PATH = '/sor/assemble';
export type IEvmChainType = Exclude<ChainType, 'solana'>;
export const ODOS_SUPPORTED_CHAINS = ['ethereum', 'arbitrum', 'base', 'optimism'] as const;
export const CHAIN_ID_BY_CHAIN: Readonly<Record<IEvmChainType, number>> = {
  ethereum: 1,
  arbitrum: Number.parseInt('42161', 10),
  base: Number.parseInt('8453', 10),
  optimism: 10,
};
export const ETH_PSEUDO_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
export const ODOS_NATIVE_ADDRESS = '0x0000000000000000000000000000000000000000';
export const DEFAULT_QUOTE_USER_ADDRESS = '0x000000000000000000000000000000000000dead';
export const HEALTHCHECK_SELL_TOKEN = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
export const HEALTHCHECK_BUY_TOKEN = '0xdac17f958d2ee523a2206206994597c13d831ec7';
export const HEALTHCHECK_SELL_AMOUNT = '10000000';
export const REQUEST_TIMEOUT_MS = 10_000;
export const DEFAULT_SLIPPAGE_PERCENT = 0.5;
export const PERCENT_TO_BPS_MULTIPLIER = 100;
export const ZERO_FEE_BPS = 0;
export const ZERO_BIGINT = 0n;

export interface IOdosQuoteToken {
  tokenAddress: string;
  amount: string;
}

export interface IOdosQuoteRequest {
  chainId: number;
  inputTokens: readonly IOdosQuoteToken[];
  outputTokens: readonly { tokenAddress: string; proportion: number }[];
  slippageLimitPercent: number;
  userAddr: string;
  disableRFQs: boolean;
  compact: boolean;
  referralCode?: number;
}

export interface IOdosQuoteResponse {
  outAmounts: readonly string[];
  pathId: string;
  gasEstimateValue?: number;
  partnerFeePercent?: number;
}

export interface IOdosAssembleRequest {
  userAddr: string;
  pathId: string;
  simulate: boolean;
}

export interface IOdosAssembleResponse {
  transaction: {
    to: string;
    data: string;
    value: string;
  };
}

export interface IOdosQuotePayloadInput {
  chain: ChainType;
  sellTokenAddress: string;
  buyTokenAddress: string;
  sellAmountBaseUnits: string;
  userAddress: string;
  slippageLimitPercent: number;
  referralCode?: number;
}
