import type { ChainType } from '../../chains/interfaces/chain.interface';

export interface ICreatePresetInput {
  userId: string;
  label: string;
  chain: ChainType;
  sellTokenAddress: string;
  buyTokenAddress: string;
  defaultAmount?: string;
}

export interface ITradePresetRecord {
  id: string;
  userId: string;
  label: string;
  chain: ChainType;
  sellTokenAddress: string;
  buyTokenAddress: string;
  defaultAmount: string | null;
  createdAt: Date;
}

export interface ITradePresetView extends ITradePresetRecord {
  sellTokenSymbol: string;
  buyTokenSymbol: string;
}
