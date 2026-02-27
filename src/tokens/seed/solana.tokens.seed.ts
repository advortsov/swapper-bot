import type { ITokenSeed } from './token-seed.interface';

export const SOLANA_TOKENS_SEED: readonly ITokenSeed[] = [
  {
    address: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    decimals: 9,
    name: 'Solana',
    chain: 'solana',
  },
  {
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    decimals: 6,
    name: 'USD Coin',
    chain: 'solana',
  },
  {
    address: 'Es9vMFrzaCERmJfrF4H2FYDsa1onbXqVUuAv89xDSHLi',
    symbol: 'USDT',
    decimals: 6,
    name: 'Tether USD',
    chain: 'solana',
  },
  {
    address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    symbol: 'JUP',
    decimals: 6,
    name: 'Jupiter',
    chain: 'solana',
  },
  {
    address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6QYaB1pPB263A1t',
    symbol: 'BONK',
    decimals: 5,
    name: 'Bonk',
    chain: 'solana',
  },
];
