import type { ChainType } from '../../chains/interfaces/chain.interface';

export type PriceAlertStatus = 'active' | 'triggered' | 'cancelled';

export interface ICreatePriceAlertInput {
  favoriteId: string;
  userId: string;
  targetToAmount: string;
}

export interface IPriceAlertRecord {
  id: string;
  favoriteId: string;
  userId: string;
  targetToAmount: string;
  status: PriceAlertStatus;
  createdAt: Date;
  updatedAt: Date;
  lastCheckedAt: Date | null;
  triggeredAt: Date | null;
  lastObservedNetToAmount: string | null;
  lastObservedAggregator: string | null;
}

export interface IPriceAlertWithFavorite extends IPriceAlertRecord {
  chain: ChainType;
  amount: string;
  fromTokenAddress: string;
  toTokenAddress: string;
  fromTokenSymbol: string;
  toTokenSymbol: string;
}
