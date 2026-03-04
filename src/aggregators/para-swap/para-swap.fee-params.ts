import { EXCLUDE_METHODS_WITHOUT_FEE_MODEL } from './para-swap.types';
import type { IQuoteRequest, ISwapRequest } from '../interfaces/aggregator.interface';

export function applyParaSwapQuoteFeeParams(url: URL, feeConfig: IQuoteRequest['feeConfig']): void {
  if (feeConfig.kind !== 'paraswap' || feeConfig.mode !== 'enforced') {
    return;
  }

  url.searchParams.set('partnerAddress', feeConfig.partnerAddress);
  url.searchParams.set('partnerFeeBps', `${feeConfig.feeBps}`);
  url.searchParams.set('excludeContractMethodsWithoutFeeModel', EXCLUDE_METHODS_WITHOUT_FEE_MODEL);
}

export function getParaSwapPartnerAddress(
  feeConfig: ISwapRequest['feeConfig'],
): string | undefined {
  if (feeConfig.kind !== 'paraswap' || feeConfig.mode !== 'enforced') {
    return undefined;
  }

  return feeConfig.partnerAddress;
}

export function getParaSwapPartnerFeeBps(feeConfig: ISwapRequest['feeConfig']): number | undefined {
  if (feeConfig.kind !== 'paraswap' || feeConfig.mode !== 'enforced') {
    return undefined;
  }

  return feeConfig.feeBps;
}
