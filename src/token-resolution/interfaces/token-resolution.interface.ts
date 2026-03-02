import type { ChainType } from '../../chains/interfaces/chain.interface';

export interface IResolvedTokenInput {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chain: ChainType;
}

export interface ICoinGeckoContractTokenPayload {
  symbol?: string;
  name?: string;
  detail_platforms?: Record<string, { contract_address?: string; decimal_place?: number | null }>;
}
