import type { ChainType } from '../../chains/interfaces/chain.interface';

export interface ISwapCommandDto {
  amount: string;
  fromTokenInput: string;
  toTokenInput: string;
  chain: ChainType;
  explicitChain: boolean;
}
