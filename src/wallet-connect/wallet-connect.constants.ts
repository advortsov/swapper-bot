import type { ChainType } from '../chains/interfaces/chain.interface';

export const DEFAULT_SWAP_TIMEOUT_SECONDS = 300;
export const MIN_SWAP_TIMEOUT_SECONDS = 1;
export const DEFAULT_SWAP_SLIPPAGE = 0.5;
export const DEFAULT_APP_PUBLIC_URL = 'https://example.org';
export const TELEGRAM_API_BASE_URL = 'https://api.telegram.org';
export const SOLANA_MAINNET_CHAIN_ID = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
export const PHANTOM_APP_BASE_URL = 'https://phantom.com/ul/v1/';
export const PHANTOM_CLUSTER = 'mainnet-beta';
export const PHANTOM_CONNECT_PATH = '/phantom/connect';
export const PHANTOM_CONNECT_CALLBACK_PATH = '/phantom/callback/connect';
export const PHANTOM_SIGN_CALLBACK_PATH = '/phantom/callback/sign';
export const PHANTOM_CONNECT_METHOD = 'connect';
export const PHANTOM_SIGN_TRANSACTION_METHOD = 'signTransaction';
export const PHANTOM_NONCE_LENGTH = 24;
export const TELEGRAM_PREVIEW_DISABLED = true;
export const EVM_NAMESPACE = 'eip155';
export const SOLANA_NAMESPACE = 'solana';
export const WALLETCONNECT_ICON_URL = 'https://walletconnect.com/walletconnect-logo.png';
export const EVM_WALLETCONNECT_METHODS = [
  'eth_sendTransaction',
  'eth_signTransaction',
  'personal_sign',
  'eth_signTypedData',
  'eth_signTypedData_v4',
] as const;
export const EVM_WALLETCONNECT_EVENTS = ['accountsChanged', 'chainChanged'] as const;
export const SOLANA_WALLETCONNECT_METHODS = [
  'solana_signTransaction',
  'solana_signAndSendTransaction',
  'solana_signMessage',
  'solana_requestAccounts',
] as const;
export const SOLANA_WALLETCONNECT_EVENTS: readonly string[] = [];

export interface IWalletConnectChainConfig {
  namespace: 'eip155' | 'solana';
  chainId: string;
  methods: readonly string[];
  events: readonly string[];
}

export const CHAIN_CONFIG_BY_CHAIN: Readonly<Record<ChainType, IWalletConnectChainConfig>> = {
  ethereum: {
    namespace: EVM_NAMESPACE,
    chainId: 'eip155:1',
    methods: EVM_WALLETCONNECT_METHODS,
    events: EVM_WALLETCONNECT_EVENTS,
  },
  arbitrum: {
    namespace: EVM_NAMESPACE,
    chainId: 'eip155:42161',
    methods: EVM_WALLETCONNECT_METHODS,
    events: EVM_WALLETCONNECT_EVENTS,
  },
  base: {
    namespace: EVM_NAMESPACE,
    chainId: 'eip155:8453',
    methods: EVM_WALLETCONNECT_METHODS,
    events: EVM_WALLETCONNECT_EVENTS,
  },
  optimism: {
    namespace: EVM_NAMESPACE,
    chainId: 'eip155:10',
    methods: EVM_WALLETCONNECT_METHODS,
    events: EVM_WALLETCONNECT_EVENTS,
  },
  solana: {
    namespace: SOLANA_NAMESPACE,
    chainId: SOLANA_MAINNET_CHAIN_ID,
    methods: SOLANA_WALLETCONNECT_METHODS,
    events: SOLANA_WALLETCONNECT_EVENTS,
  },
};
