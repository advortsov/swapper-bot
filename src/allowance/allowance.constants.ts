import { arbitrum, base, mainnet, optimism } from 'viem/chains';

import type { ChainType } from '../chains/interfaces/chain.interface';

export const EVM_NATIVE_TOKEN_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
export const DUMMY_USER_ADDRESS = '0x000000000000000000000000000000000000dead';
export const ALLOWANCE_ACTION_KIND = 'approve';
export const EVM_CHAINS = ['ethereum', 'arbitrum', 'base', 'optimism'] as const;
export const EVM_CHAIN_CONFIG = {
  ethereum: {
    chain: mainnet,
    envKey: 'ETH_RPC_URL',
  },
  arbitrum: {
    chain: arbitrum,
    envKey: 'ARBITRUM_RPC_URL',
  },
  base: {
    chain: base,
    envKey: 'BASE_RPC_URL',
  },
  optimism: {
    chain: optimism,
    envKey: 'OPTIMISM_RPC_URL',
  },
} as const;

export const ERC20_ALLOWANCE_ABI = [
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const ERC20_APPROVE_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export type IEvmChainType = (typeof EVM_CHAINS)[number];

export interface IPendingApproveActionPayload {
  chain: ChainType;
  tokenSymbol: string;
  tokenAddress: string;
  tokenDecimals: number;
  amount: string;
  amountBaseUnits: string;
  walletAddress: string | null;
  options: readonly {
    aggregatorName: string;
    spenderAddress: string;
    currentAllowance: string | null;
    currentAllowanceBaseUnits: string | null;
  }[];
}

export interface IResolvedApproveContext {
  chain: ChainType;
  tokenSymbol: string;
  tokenAddress: string;
  tokenDecimals: number;
  amount: string;
  amountBaseUnits: string;
}

export interface IAllowanceClient {
  readContract(input: {
    address: `0x${string}`;
    abi: typeof ERC20_ALLOWANCE_ABI;
    functionName: 'allowance';
    args: readonly [`0x${string}`, `0x${string}`];
  }): Promise<bigint>;
}
