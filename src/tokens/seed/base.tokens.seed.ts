import type { ITokenSeed } from './token-seed.interface';

export const BASE_TOKENS_SEED: readonly ITokenSeed[] = [
  {
    address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    symbol: 'ETH',
    decimals: 18,
    name: 'Ether',
    chain: 'base',
  },
  {
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    symbol: 'USDC',
    decimals: 6,
    name: 'USD Coin',
    chain: 'base',
  },
  {
    address: '0x4200000000000000000000000000000000000006',
    symbol: 'WETH',
    decimals: 18,
    name: 'Wrapped Ether',
    chain: 'base',
  },
  {
    address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    symbol: 'DAI',
    decimals: 18,
    name: 'Dai Stablecoin',
    chain: 'base',
  },
  {
    address: '0xcbB7C0000ab88B473b1f5AFD9eA2A0afA6F7Ea5d',
    symbol: 'CBBTC',
    decimals: 8,
    name: 'Coinbase Wrapped BTC',
    chain: 'base',
  },
];
