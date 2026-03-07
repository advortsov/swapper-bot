import type { ChainType } from '../../chains/interfaces/chain.interface';

export interface IPortfolioAsset {
  chain: ChainType;
  symbol: string;
  address: string;
  decimals: number;
  balanceBaseUnits: string;
  balanceFormatted: string;
  estimatedUsd: string | null;
}

export interface IPortfolioSummary {
  totalEstimatedUsd: string;
  assets: IPortfolioAsset[];
}
