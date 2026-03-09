import type { IWalletConnectApprovalPayload } from '../../allowance/interfaces/allowance.interface';
import type { ChainType } from '../../chains/interfaces/chain.interface';
import type {
  FeeAssetSide,
  FeeMode,
  FeeType,
  IExecutionFeeConfig,
} from '../../fees/interfaces/fee-policy.interface';

export type WalletConnectionFamily = 'evm' | 'solana';

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
  estimatedGasUsd: number | null;
  priceImpactPercent: number | null;
  routeHops: number | null;
}

export interface ICreateWalletConnectSessionInput {
  userId: string;
  swapPayload: IWalletConnectSwapPayload;
}

export interface ICreateWalletConnectApproveSessionInput {
  userId: string;
  approvalPayload: IWalletConnectApprovalPayload;
}

export interface ICreateWalletConnectConnectionInput {
  userId: string;
  chain: ChainType;
}

export interface IWalletConnectSession {
  sessionId: string;
  userId: string;
  uri: string;
  expiresAt: number;
  kind: 'connect' | 'swap' | 'approve';
  family: WalletConnectionFamily;
  chain: ChainType;
  pairingTopic?: string;
  swapPayload?: IWalletConnectSwapPayload;
  approvalPayload?: IWalletConnectApprovalPayload;
  phantom?: IPhantomSessionState;
}

export interface IWalletConnectSessionPublic {
  sessionId: string;
  uri: string | null;
  expiresAt: string;
  walletDelivery: 'qr' | 'app-link' | 'connected-wallet';
}

export interface IWalletConnectionSession {
  userId: string;
  family: WalletConnectionFamily;
  chain: ChainType;
  address: string;
  topic?: string;
  walletLabel: string | null;
  connectedAt: number;
  lastUsedAt: number;
  expiresAt: number;
  phantom?: IPhantomSessionState;
}

export interface IWalletConnectionStatus {
  evm: IWalletConnectionSession | null;
  solana: IWalletConnectionSession | null;
}

export interface IPendingTelegramAction {
  token: string;
  userId: string;
  kind: 'favorite' | 'alert-threshold' | 'approve' | 'preset-add' | 'preset-save';
  payload: Record<string, unknown>;
  createdAt: number;
  expiresAt: number;
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
