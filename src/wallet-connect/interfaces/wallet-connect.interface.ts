import type { ChainType } from '../../chains/interfaces/chain.interface';
import type {
  FeeAssetSide,
  FeeMode,
  FeeType,
  IExecutionFeeConfig,
} from '../../fees/interfaces/fee-policy.interface';

export interface IWalletConnectSwapPayload {
  intentId: string;
  executionId: string;
  chain: ChainType;
  aggregatorName: string;
  fromSymbol: string;
  toSymbol: string;
  sellTokenAddress: string;
  buyTokenAddress: string;
  sellAmountBaseUnits: string;
  sellTokenDecimals: number;
  buyTokenDecimals: number;
  slippagePercentage: number;
  grossToAmountBaseUnits: string;
  netToAmountBaseUnits: string;
  feeAmountBaseUnits: string;
  feeAmountSymbol: string | null;
  feeAmountDecimals: number | null;
  feeMode: FeeMode;
  feeType: FeeType;
  feeBps: number;
  feeDisplayLabel: string;
  feeAssetSide: FeeAssetSide;
  executionFee: IExecutionFeeConfig;
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
