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
  phantom?: IPhantomSessionState;
}

export interface IWalletConnectSessionPublic {
  sessionId: string;
  uri: string;
  expiresAt: string;
}

export interface IPhantomSessionState {
  dappEncryptionPublicKey: string;
  dappEncryptionSecretKey: string;
  sharedSecret?: string;
  phantomEncryptionPublicKey?: string;
  phantomSession?: string;
  walletAddress?: string;
  lastValidBlockHeight?: number;
}

export interface IPhantomCallbackQuery {
  sessionId: string;
  phantom_encryption_public_key?: string;
  nonce?: string;
  data?: string;
  errorCode?: string;
  errorMessage?: string;
}
