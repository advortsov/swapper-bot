export const SUPPORTED_CHAINS = ['ethereum', 'arbitrum', 'base', 'optimism', 'solana'] as const;
export type ChainType = (typeof SUPPORTED_CHAINS)[number];
export const DEFAULT_CHAIN: ChainType = 'ethereum';

export interface IChain {
  readonly chainId: number | string;
  readonly name: ChainType;

  getGasPrice(): Promise<bigint>;
  getTokenDecimals(tokenAddress: string): Promise<number>;
  validateAddress(address: string): boolean;
  buildExplorerUrl(txHash: string): string;
}
