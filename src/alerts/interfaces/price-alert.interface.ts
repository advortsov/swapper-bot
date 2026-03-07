import type { ChainType } from '../../chains/interfaces/chain.interface';

export type PriceAlertStatus = 'active' | 'triggered' | 'cancelled';
export type AlertKind = 'fixed' | 'percentage' | 'asset';
export type AlertDirection = 'up' | 'down' | 'cross' | null;

export interface ICreatePriceAlertInput {
  favoriteId: string | null;
  userId: string;
  targetToAmount: string | null;
  kind: AlertKind;
  direction?: AlertDirection;
  percentageChange?: number;
  repeatable?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  watchTokenAddress?: string;
  watchChain?: ChainType;
}

export interface IPriceAlertRecord {
  id: string;
  favoriteId: string | null;
  userId: string;
  targetToAmount: string | null;
  status: PriceAlertStatus;
  createdAt: Date;
  updatedAt: Date;
  lastCheckedAt: Date | null;
  triggeredAt: Date | null;
  lastObservedNetToAmount: string | null;
  lastObservedAggregator: string | null;
  kind: AlertKind;
  direction: AlertDirection | null;
  percentageChange: number | null;
  repeatable: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  watchTokenAddress: string | null;
  watchChain: ChainType | null;
}

export interface IPriceAlertWithFavorite extends IPriceAlertRecord {
  chain: ChainType;
  amount: string;
  fromTokenAddress: string;
  toTokenAddress: string;
  fromTokenSymbol: string;
  toTokenSymbol: string;
}
