import type { ChainType } from '../../chains/interfaces/chain.interface';

export interface ITokenSeed {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  chain: ChainType;
}
