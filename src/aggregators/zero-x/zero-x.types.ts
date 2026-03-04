import type { ChainType } from '../../chains/interfaces/chain.interface';

export const ZERO_X_VERSION = 'v2';
export const DEFAULT_ZERO_X_API_BASE_URL = 'https://api.0x.org';
export const DEFAULT_TAKER_ADDRESS = '0x0000000000000000000000000000000000010000';
export const BPS_PERCENT_MULTIPLIER = 100;
export type IEvmChainType = Exclude<ChainType, 'solana'>;
export const ZERO_X_SUPPORTED_CHAINS = ['ethereum', 'arbitrum', 'base', 'optimism'] as const;
export const CHAIN_ID_BY_CHAIN: Readonly<Record<IEvmChainType, string>> = {
  ethereum: '1',
  arbitrum: '42161',
  base: '8453',
  optimism: '10',
};

export interface IZeroXQuoteResponse {
  buyAmount: string;
  liquidityAvailable: boolean;
  totalNetworkFee: string | null;
  allowanceTarget?: string;
  fees?: {
    integratorFee?: {
      amount: string;
    } | null;
  };
  transaction?: IZeroXSwapTransaction;
}

export interface IZeroXSwapTransaction {
  to: string;
  data: string;
  value: string;
}
