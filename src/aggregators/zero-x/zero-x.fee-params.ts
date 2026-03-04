import type { IQuoteRequest } from '../interfaces/aggregator.interface';

export function applyZeroXFeeParams(url: URL, feeConfig: IQuoteRequest['feeConfig']): void {
  if (feeConfig.kind !== 'zerox' || feeConfig.mode !== 'enforced') {
    return;
  }

  url.searchParams.set('swapFeeRecipient', feeConfig.feeRecipient);
  url.searchParams.set('swapFeeBps', `${feeConfig.feeBps}`);
  url.searchParams.set('swapFeeToken', feeConfig.feeTokenAddress);
}
