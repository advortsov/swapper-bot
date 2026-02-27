export type ChainType = 'ethereum';

export interface IChain {
  readonly chainId: number | string;
  readonly name: ChainType;

  getGasPrice(): Promise<bigint>;
  getTokenDecimals(tokenAddress: string): Promise<number>;
  validateAddress(address: string): boolean;
  buildExplorerUrl(txHash: string): string;
}
