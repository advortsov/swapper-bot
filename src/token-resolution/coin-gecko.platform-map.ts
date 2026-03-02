import type { ChainType } from '../chains/interfaces/chain.interface';

export const COINGECKO_PLATFORM_BY_CHAIN: Readonly<Record<ChainType, string>> = {
  ethereum: 'ethereum',
  arbitrum: 'arbitrum-one',
  base: 'base',
  optimism: 'optimism',
  solana: 'solana',
};
