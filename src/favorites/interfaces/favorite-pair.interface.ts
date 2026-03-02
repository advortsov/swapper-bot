import type { ChainType } from '../../chains/interfaces/chain.interface';

export interface ICreateFavoriteInput {
  userId: string;
  chain: ChainType;
  amount: string;
  fromTokenChain: ChainType;
  fromTokenAddress: string;
  toTokenChain: ChainType;
  toTokenAddress: string;
}

export interface IFavoritePairRecord {
  id: string;
  userId: string;
  chain: ChainType;
  amount: string;
  fromTokenChain: ChainType;
  fromTokenAddress: string;
  toTokenChain: ChainType;
  toTokenAddress: string;
  createdAt: Date;
}

export interface IFavoritePairView extends IFavoritePairRecord {
  fromTokenSymbol: string;
  toTokenSymbol: string;
}
