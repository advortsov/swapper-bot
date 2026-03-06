import { describe, expect, it, vi } from 'vitest';

import { SwapSelectionService } from '../../src/swap/swap.selection.service';
import { createDisabledFeeConfig } from '../support/fee.fixtures';

const consumedIntent = {
  intentId: 'intent-id',
  userId: 'user-1',
  chain: 'ethereum' as const,
  rawCommand: '/swap 10 ETH to USDC',
  aggregator: 'paraswap',
  quoteExpiresAt: new Date('2026-03-02T00:05:00.000Z'),
  quoteSnapshot: {
    chain: 'ethereum' as const,
    normalizedAmount: '10',
    sellAmountBaseUnits: '100',
    fromToken: {
      address: '0x1',
      symbol: 'ETH',
      decimals: 18,
      name: 'Ether',
      chain: 'ethereum' as const,
    },
    toToken: {
      address: '0x2',
      symbol: 'USDC',
      decimals: 6,
      name: 'USD Coin',
      chain: 'ethereum' as const,
    },
    providerQuotes: [
      {
        aggregatorName: 'paraswap',
        grossToAmountBaseUnits: '1000',
        netToAmountBaseUnits: '999',
        feeAmountBaseUnits: '1',
        feeAmountSymbol: 'USDC',
        feeAmountDecimals: 6,
        feeBps: 10,
        feeMode: 'disabled' as const,
        feeType: 'no fee' as const,
        feeDisplayLabel: 'no fee',
        feeAppliedAtQuote: false,
        feeEnforcedOnExecution: false,
        feeAssetSide: 'none' as const,
        executionFee: createDisabledFeeConfig('paraswap', 'ethereum'),
        estimatedGasUsd: null,
        priceImpactPercent: null,
        routeHops: null,
        totalNetworkFeeWei: null,
        rawQuoteHash: 'hash',
      },
    ],
  },
};

describe('SwapSelectionService', () => {
  it('должен выбирать котировку по агрегатору из consumed intent', () => {
    const service = new SwapSelectionService({} as never);

    const selectedQuote = service.getSelectedQuote(consumedIntent);

    expect(selectedQuote.aggregatorName).toBe('paraswap');
  });

  it('должен создавать execution с fee payload из intent snapshot', async () => {
    const hashPayload = vi.fn().mockReturnValue('swap-hash');
    const createExecution = vi.fn().mockResolvedValue('execution-id');
    const [storedQuote] = consumedIntent.quoteSnapshot.providerQuotes;
    const service = new SwapSelectionService({
      hashPayload,
      createExecution,
    } as never);

    if (!storedQuote) {
      throw new Error('storedQuote fixture is missing');
    }

    const executionId = await service.createExecution({
      consumedIntent,
      selectedQuote: storedQuote,
      slippage: 0.5,
    });

    expect(executionId).toBe('execution-id');
    expect(hashPayload).toHaveBeenCalledWith({
      intentId: 'intent-id',
      chain: 'ethereum',
      aggregator: 'paraswap',
      sellTokenAddress: '0x1',
      buyTokenAddress: '0x2',
      sellAmountBaseUnits: '100',
      slippage: 0.5,
      feeConfig: createDisabledFeeConfig('paraswap', 'ethereum'),
    });
    expect(createExecution).toHaveBeenCalledWith({
      intentId: 'intent-id',
      userId: 'user-1',
      chain: 'ethereum',
      aggregator: 'paraswap',
      feeMode: 'disabled',
      feeBps: 10,
      feeRecipient: null,
      grossToAmount: '1000',
      botFeeAmount: '1',
      netToAmount: '999',
      quotePayloadHash: 'hash',
      swapPayloadHash: 'swap-hash',
    });
  });
});
