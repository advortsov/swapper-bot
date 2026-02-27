import type { ChainType } from '../../chains/interfaces/chain.interface';

export interface IWalletConnectSwapPayload {
  chain: ChainType;
  aggregatorName: string;
  sellTokenAddress: string;
  buyTokenAddress: string;
  sellAmountBaseUnits: string;
  slippagePercentage: number;
}

export interface ICreateWalletConnectSessionInput {
  userId: string;
  swapPayload: IWalletConnectSwapPayload;
}

export interface IWalletConnectSession {
  sessionId: string;
  userId: string;
  uri: string;
  expiresAt: number;
  swapPayload: IWalletConnectSwapPayload;
}

export interface IWalletConnectSessionPublic {
  sessionId: string;
  uri: string;
  expiresAt: string;
}
