import type { ChainType } from '../../chains/interfaces/chain.interface';

export interface IPriceCommandDto {
  amount: string;
  fromSymbol: string;
  toSymbol: string;
  chain: ChainType;
}
