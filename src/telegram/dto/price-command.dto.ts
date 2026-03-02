import type { ChainType } from '../../chains/interfaces/chain.interface';

export interface IPriceCommandDto {
  amount: string;
  fromTokenInput: string;
  toTokenInput: string;
  chain: ChainType;
  explicitChain: boolean;
}
