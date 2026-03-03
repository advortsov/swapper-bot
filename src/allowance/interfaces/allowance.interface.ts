import type { ChainType } from '../../chains/interfaces/chain.interface';

export type ApprovalMode = 'exact' | 'max';

export interface IApprovalTargetRequest {
  chain: ChainType;
  sellTokenAddress: string;
  buyTokenAddress: string;
  sellAmountBaseUnits: string;
  userAddress: string;
}

export interface IApprovalTargetResponse {
  spenderAddress: string;
}

export interface IAllowanceCheckRequest {
  chain: ChainType;
  tokenAddress: string;
  ownerAddress: string;
  spenderAddress: string;
}

export interface IAllowanceCheckResult {
  allowanceBaseUnits: string;
}

export interface IApproveCommandRequest {
  userId: string;
  amount: string;
  tokenInput: string;
  chain: ChainType;
  explicitChain: boolean;
  walletAddress: string | null;
}

export interface IApproveOptionView {
  aggregatorName: string;
  spenderAddress: string;
  currentAllowance: string | null;
  currentAllowanceBaseUnits: string | null;
}

export interface IApproveOptionsResponse {
  actionToken: string;
  chain: ChainType;
  tokenSymbol: string;
  tokenAddress: string;
  tokenDecimals: number;
  amount: string;
  amountBaseUnits: string;
  walletAddress: string | null;
  options: readonly IApproveOptionView[];
}

export interface IPreparedApproveExecution {
  actionToken: string;
  chain: ChainType;
  tokenSymbol: string;
  tokenAddress: string;
  tokenDecimals: number;
  amount: string;
  amountBaseUnits: string;
  currentAllowance: string | null;
  currentAllowanceBaseUnits: string | null;
  aggregatorName: string;
  spenderAddress: string;
  mode: ApprovalMode;
  approveAmountBaseUnits: string;
}

export interface IWalletConnectApprovalPayload {
  chain: ChainType;
  tokenSymbol: string;
  tokenAddress: string;
  tokenDecimals: number;
  spenderAddress: string;
  aggregatorName: string;
  mode: ApprovalMode;
  currentAllowanceBaseUnits: string | null;
  amount: string;
  amountBaseUnits: string;
  approveAmountBaseUnits: string;
}

export interface IApproveSessionResponse {
  chain: ChainType;
  tokenSymbol: string;
  tokenAddress: string;
  aggregatorName: string;
  spenderAddress: string;
  mode: ApprovalMode;
  amount: string;
  currentAllowance: string | null;
  walletConnectUri: string | null;
  sessionId: string;
  expiresAt: string;
  walletDelivery: 'qr' | 'app-link' | 'connected-wallet';
}
