import { applyZeroXFeeParams } from './zero-x.fee-params';
import { BPS_PERCENT_MULTIPLIER, CHAIN_ID_BY_CHAIN } from './zero-x.types';
import type { ChainType } from '../../chains/interfaces/chain.interface';
import { BusinessException } from '../../common/exceptions/business.exception';
import type { IQuoteRequest, ISwapRequest } from '../interfaces/aggregator.interface';

export function buildZeroXQuoteUrl(
  apiBaseUrl: string,
  takerAddress: string,
  params: IQuoteRequest,
): URL {
  const url = new URL('/swap/allowance-holder/quote', apiBaseUrl);

  url.searchParams.set('chainId', resolveZeroXChainId(params.chain));
  url.searchParams.set('sellToken', params.sellTokenAddress);
  url.searchParams.set('buyToken', params.buyTokenAddress);
  url.searchParams.set('sellAmount', params.sellAmountBaseUnits);
  url.searchParams.set('taker', takerAddress);
  applyZeroXFeeParams(url, params.feeConfig);

  return url;
}

export function buildZeroXSwapUrl(apiBaseUrl: string, params: ISwapRequest): URL {
  const url = new URL('/swap/allowance-holder/quote', apiBaseUrl);

  url.searchParams.set('chainId', resolveZeroXChainId(params.chain));
  url.searchParams.set('sellToken', params.sellTokenAddress);
  url.searchParams.set('buyToken', params.buyTokenAddress);
  url.searchParams.set('sellAmount', params.sellAmountBaseUnits);
  url.searchParams.set('taker', params.fromAddress);
  url.searchParams.set('slippageBps', toZeroXSlippageBps(params.slippagePercentage));
  applyZeroXFeeParams(url, params.feeConfig);

  return url;
}

export function resolveZeroXChainId(chain: ChainType): string {
  if (chain === 'solana') {
    throw new BusinessException('0x does not support Solana');
  }

  return CHAIN_ID_BY_CHAIN[chain];
}

export function toZeroXSlippageBps(slippagePercentage: number): string {
  const slippageBps = Math.round(slippagePercentage * BPS_PERCENT_MULTIPLIER);
  return `${Math.max(slippageBps, 1)}`;
}
