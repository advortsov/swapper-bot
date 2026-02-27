export interface IEthereumTokenSeed {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  chain: string;
}

export const ETHEREUM_TOKENS_SEED: readonly IEthereumTokenSeed[] = [
  {
    address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    symbol: 'ETH',
    decimals: 18,
    name: 'Ethereum',
    chain: 'ethereum',
  },
  {
    address: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    symbol: 'USDC',
    decimals: 6,
    name: 'USD Coin',
    chain: 'ethereum',
  },
  {
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    symbol: 'USDT',
    decimals: 6,
    name: 'Tether USD',
    chain: 'ethereum',
  },
  {
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    symbol: 'WETH',
    decimals: 18,
    name: 'Wrapped Ether',
    chain: 'ethereum',
  },
  {
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    symbol: 'WBTC',
    decimals: 8,
    name: 'Wrapped Bitcoin',
    chain: 'ethereum',
  },
  {
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    symbol: 'DAI',
    decimals: 18,
    name: 'Dai Stablecoin',
    chain: 'ethereum',
  },
  {
    address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    symbol: 'UNI',
    decimals: 18,
    name: 'Uniswap',
    chain: 'ethereum',
  },
  {
    address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    symbol: 'LINK',
    decimals: 18,
    name: 'Chainlink',
    chain: 'ethereum',
  },
  {
    address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDAE9',
    symbol: 'AAVE',
    decimals: 18,
    name: 'Aave',
    chain: 'ethereum',
  },
  {
    address: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2',
    symbol: 'MKR',
    decimals: 18,
    name: 'Maker',
    chain: 'ethereum',
  },
  {
    address: '0xD533a949740bb3306d119CC777fa900bA034cd52',
    symbol: 'CRV',
    decimals: 18,
    name: 'Curve DAO Token',
    chain: 'ethereum',
  },
  {
    address: '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32',
    symbol: 'LDO',
    decimals: 18,
    name: 'Lido DAO Token',
    chain: 'ethereum',
  },
];
