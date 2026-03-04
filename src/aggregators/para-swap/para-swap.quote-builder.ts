import { applyParaSwapQuoteFeeParams } from './para-swap.fee-params';
import {
  DEFAULT_PARASWAP_API_VERSION,
  HEALTHCHECK_SELL_AMOUNT,
  NETWORK_BY_CHAIN,
  PARASWAP_NATIVE_TOKEN,
  SELL_SIDE,
  USDC_DECIMALS,
  USDC_TOKEN,
  WETH_DECIMALS,
} from './para-swap.types';
import type { ChainType } from '../../chains/interfaces/chain.interface';
import { BusinessException } from '../../common/exceptions/business.exception';
import type { IQuoteRequest } from '../interfaces/aggregator.interface';

export function buildParaSwapQuoteUrl(
  apiBaseUrl: string,
  apiVersion: string,
  params: IQuoteRequest,
): URL {
  const url = new URL('/prices', apiBaseUrl);

  url.searchParams.set('srcToken', normalizeParaSwapToken(params.sellTokenAddress));
  url.searchParams.set('destToken', normalizeParaSwapToken(params.buyTokenAddress));
  url.searchParams.set('amount', params.sellAmountBaseUnits);
  url.searchParams.set('srcDecimals', `${params.sellTokenDecimals}`);
  url.searchParams.set('destDecimals', `${params.buyTokenDecimals}`);
  url.searchParams.set('side', SELL_SIDE);
  url.searchParams.set('network', resolveParaSwapNetwork(params.chain));
  url.searchParams.set('version', apiVersion);
  applyParaSwapQuoteFeeParams(url, params.feeConfig);

  return url;
}

export function buildParaSwapHealthcheckUrl(
  apiBaseUrl: string,
  apiVersion = DEFAULT_PARASWAP_API_VERSION,
): URL {
  const url = new URL('/prices', apiBaseUrl);

  url.searchParams.set('srcToken', PARASWAP_NATIVE_TOKEN);
  url.searchParams.set('destToken', USDC_TOKEN);
  url.searchParams.set('amount', HEALTHCHECK_SELL_AMOUNT);
  url.searchParams.set('srcDecimals', WETH_DECIMALS);
  url.searchParams.set('destDecimals', USDC_DECIMALS);
  url.searchParams.set('side', SELL_SIDE);
  url.searchParams.set('network', NETWORK_BY_CHAIN.ethereum);
  url.searchParams.set('version', apiVersion);

  return url;
}

export function normalizeParaSwapToken(tokenAddress: string): string {
  const normalized = tokenAddress.trim().toLowerCase();

  if (normalized === PARASWAP_NATIVE_TOKEN) {
    return PARASWAP_NATIVE_TOKEN;
  }

  return normalized;
}

export function resolveParaSwapNetwork(chain: ChainType): string {
  if (chain === 'solana') {
    throw new BusinessException('ParaSwap does not support Solana');
  }

  return NETWORK_BY_CHAIN[chain];
}
