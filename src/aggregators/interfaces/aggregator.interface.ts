import type { ChainType } from '../../chains/interfaces/chain.interface';

export interface IQuoteRequest {
  chain: ChainType;
  sellTokenAddress: string;
  buyTokenAddress: string;
  sellAmountBaseUnits: string;
}

export interface IQuoteResponse {
  aggregatorName: string;
  toAmountBaseUnits: string;
  estimatedGasUsd: number | null;
  totalNetworkFeeWei: string | null;
  rawQuote: unknown;
}

export interface ISwapRequest {
  chain: ChainType;
}

export interface ISwapTransaction {
  to: string;
  data: string;
  value: string;
}

export interface IAggregator {
  readonly name: string;
  readonly supportedChains: readonly ChainType[];

  getQuote(params: IQuoteRequest): Promise<IQuoteResponse>;
  buildSwapTransaction(params: ISwapRequest): Promise<ISwapTransaction>;
  healthCheck(): Promise<boolean>;
}
