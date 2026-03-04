import { getParaSwapPartnerAddress, getParaSwapPartnerFeeBps } from './para-swap.fee-params';
import { normalizeParaSwapToken, resolveParaSwapNetwork } from './para-swap.quote-builder';
import type { IParaSwapPriceRoute } from './para-swap.types';
import type { ISwapRequest } from '../interfaces/aggregator.interface';

export function buildParaSwapTransactionUrl(apiBaseUrl: string, chain: ISwapRequest['chain']): URL {
  const network = resolveParaSwapNetwork(chain);
  const transactionUrl = new URL(`/transactions/${network}`, apiBaseUrl);
  transactionUrl.searchParams.set('ignoreChecks', 'true');

  return transactionUrl;
}

export function buildParaSwapTransactionBody(
  params: ISwapRequest,
  priceRoute: IParaSwapPriceRoute,
): Record<string, unknown> {
  return {
    srcToken: normalizeParaSwapToken(params.sellTokenAddress),
    destToken: normalizeParaSwapToken(params.buyTokenAddress),
    srcAmount: params.sellAmountBaseUnits,
    srcDecimals: params.sellTokenDecimals,
    destDecimals: params.buyTokenDecimals,
    userAddress: params.fromAddress,
    slippage: params.slippagePercentage,
    priceRoute,
    partnerAddress: getParaSwapPartnerAddress(params.feeConfig),
    partnerFeeBps: getParaSwapPartnerFeeBps(params.feeConfig),
  };
}
