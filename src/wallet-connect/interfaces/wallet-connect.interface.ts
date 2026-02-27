import type { ChainType } from '../../chains/interfaces/chain.interface';

export interface IWalletConnectSwapPayload {
  chain: ChainType;
  aggregatorName: string;
  sellTokenAddress: string;
  buyTokenAddress: string;
  sellAmountBaseUnits: string;
  sellTokenDecimals: number;
  buyTokenDecimals: number;
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
  pairingTopic?: string;
  swapPayload: IWalletConnectSwapPayload;
}

export interface IWalletConnectSessionPublic {
  sessionId: string;
  uri: string;
  expiresAt: string;
}
