import type { ITokenSeed } from './token-seed.interface';

export const ARBITRUM_TOKENS_SEED: readonly ITokenSeed[] = [
  {
    address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    symbol: 'ETH',
    decimals: 18,
    name: 'Ether',
    chain: 'arbitrum',
  },
  {
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    symbol: 'USDC',
    decimals: 6,
    name: 'USD Coin',
    chain: 'arbitrum',
  },
  {
    address: '0xFd086bC7CD5C481DCC9C85e478A1C0b69FCbb9',
    symbol: 'USDT',
    decimals: 6,
    name: 'Tether USD',
    chain: 'arbitrum',
  },
  {
    address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    symbol: 'WETH',
    decimals: 18,
    name: 'Wrapped Ether',
    chain: 'arbitrum',
  },
  {
    address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
    symbol: 'WBTC',
    decimals: 8,
    name: 'Wrapped BTC',
    chain: 'arbitrum',
  },
  {
    address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    symbol: 'DAI',
    decimals: 18,
    name: 'Dai Stablecoin',
    chain: 'arbitrum',
  },
];
