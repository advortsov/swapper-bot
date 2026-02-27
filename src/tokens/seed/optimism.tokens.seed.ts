import type { ITokenSeed } from './token-seed.interface';

export const OPTIMISM_TOKENS_SEED: readonly ITokenSeed[] = [
  {
    address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    symbol: 'ETH',
    decimals: 18,
    name: 'Ether',
    chain: 'optimism',
  },
  {
    address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    symbol: 'USDC',
    decimals: 6,
    name: 'USD Coin',
    chain: 'optimism',
  },
  {
    address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    symbol: 'USDT',
    decimals: 6,
    name: 'Tether USD',
    chain: 'optimism',
  },
  {
    address: '0x4200000000000000000000000000000000000006',
    symbol: 'WETH',
    decimals: 18,
    name: 'Wrapped Ether',
    chain: 'optimism',
  },
  {
    address: '0x68f180fcCe6836688e9084f035309E29Bf0A2095',
    symbol: 'WBTC',
    decimals: 8,
    name: 'Wrapped BTC',
    chain: 'optimism',
  },
  {
    address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    symbol: 'DAI',
    decimals: 18,
    name: 'Dai Stablecoin',
    chain: 'optimism',
  },
];
