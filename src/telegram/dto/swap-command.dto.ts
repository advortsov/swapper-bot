import type { ChainType } from '../../chains/interfaces/chain.interface';

export interface ISwapCommandDto {
  amount: string;
  fromSymbol: string;
  toSymbol: string;
  chain: ChainType;
}
