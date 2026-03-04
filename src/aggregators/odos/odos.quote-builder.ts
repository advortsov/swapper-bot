import type { IOdosAssembleRequest, IOdosQuotePayloadInput, IOdosQuoteRequest } from './odos.types';
import { CHAIN_ID_BY_CHAIN, ETH_PSEUDO_ADDRESS, ODOS_NATIVE_ADDRESS } from './odos.types';
import type { ChainType } from '../../chains/interfaces/chain.interface';
import { BusinessException } from '../../common/exceptions/business.exception';

export function buildOdosQuotePayload(input: IOdosQuotePayloadInput): IOdosQuoteRequest {
  return {
    chainId: resolveOdosChainId(input.chain),
    inputTokens: [
      {
        tokenAddress: normalizeOdosTokenAddress(input.sellTokenAddress),
        amount: input.sellAmountBaseUnits,
      },
    ],
    outputTokens: [
      {
        tokenAddress: normalizeOdosTokenAddress(input.buyTokenAddress),
        proportion: 1,
      },
    ],
    slippageLimitPercent: input.slippageLimitPercent,
    userAddr: input.userAddress,
    disableRFQs: true,
    compact: true,
    ...(input.referralCode !== undefined ? { referralCode: input.referralCode } : {}),
  };
}

export function buildOdosAssemblePayload(
  userAddress: string,
  pathId: string,
): IOdosAssembleRequest {
  return {
    userAddr: userAddress,
    pathId,
    simulate: false,
  };
}

export function normalizeOdosTokenAddress(address: string): string {
  const normalized = address.trim();

  if (normalized.toLowerCase() == ETH_PSEUDO_ADDRESS) {
    return ODOS_NATIVE_ADDRESS;
  }

  return normalized;
}

export function resolveOdosChainId(chain: ChainType): number {
  if (chain === 'solana') {
    throw new BusinessException('Odos does not support Solana');
  }

  return CHAIN_ID_BY_CHAIN[chain];
}
