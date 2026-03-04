import type { ChainType } from '../../chains/interfaces/chain.interface';

export const DEFAULT_PARASWAP_API_BASE_URL = 'https://api.paraswap.io';
export type IEvmChainType = Exclude<ChainType, 'solana'>;
export const PARASWAP_SUPPORTED_CHAINS = ['ethereum', 'arbitrum', 'base', 'optimism'] as const;
export const NETWORK_BY_CHAIN: Readonly<Record<IEvmChainType, string>> = {
  ethereum: '1',
  arbitrum: '42161',
  base: '8453',
  optimism: '10',
};
export const SELL_SIDE = 'SELL';
export const PARASWAP_NATIVE_TOKEN = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
export const USDC_TOKEN = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
export const USDC_DECIMALS = '6';
export const WETH_DECIMALS = '18';
export const HEALTHCHECK_SELL_AMOUNT = '1000000000000000';
export const ZERO_BIGINT = 0n;
export const REQUEST_TIMEOUT_MS = 10_000;
export const ERROR_BODY_MAX_LENGTH = 300;
export const DEFAULT_PARASWAP_API_VERSION = '6.2';
export const EXCLUDE_METHODS_WITHOUT_FEE_MODEL = 'true';

export interface IParaSwapPriceRoute {
  destAmount: string;
  gasCostUSD?: string;
  tokenTransferProxy?: string;
  contractAddress?: string;
}

export interface IParaSwapQuoteResponse {
  priceRoute: IParaSwapPriceRoute & Record<string, unknown>;
}

export interface IParaSwapTransactionResponse {
  to: string;
  data: string;
  value: string;
}
