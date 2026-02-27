export interface IPriceRequest {
  userId: string;
  amount: string;
  fromSymbol: string;
  toSymbol: string;
  rawCommand: string;
}

export interface IPriceResponse {
  chain: string;
  aggregator: string;
  fromSymbol: string;
  toSymbol: string;
  fromAmount: string;
  toAmount: string;
  estimatedGasUsd: number | null;
}
