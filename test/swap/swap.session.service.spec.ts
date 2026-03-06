import { describe, expect, it, vi } from 'vitest';

import { SwapSessionService } from '../../src/swap/swap.session.service';
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
    providerQuotes: [],
  },
};

const selectedQuote = {
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
};

describe('SwapSessionService', () => {
  it('должен собирать ответ на подготовленную swap session', () => {
    const service = new SwapSessionService({} as never, {} as never);

    const response = service.buildResponse({
      consumedIntent,
      selectedQuote,
      walletConnectSession: {
        sessionId: 'session-id',
        uri: 'wc:test',
        expiresAt: '2026-03-02T00:10:00.000Z',
        walletDelivery: 'qr',
      },
      quoteExpiresAt: '2026-03-02T00:05:00.000Z',
    });

    expect(response.intentId).toBe('intent-id');
    expect(response.sessionId).toBe('session-id');
    expect(response.walletConnectUri).toBe('wc:test');
  });

  it('должен помечать execution ошибкой, если WalletConnect session не создалась', async () => {
    const markExecutionError = vi.fn().mockResolvedValue(undefined);
    const createSession = vi.fn().mockRejectedValue(new Error('WalletConnect init failed'));
    const service = new SwapSessionService(
      { createSession } as never,
      { markExecutionError } as never,
    );

    await expect(
      service.createWalletConnectSession({
        userId: 'user-1',
        executionId: 'execution-id',
        slippage: 0.5,
        consumedIntent,
        selectedQuote,
      }),
    ).rejects.toThrowError('WalletConnect init failed');

    expect(markExecutionError).toHaveBeenCalledWith(
      'execution-id',
      'paraswap',
      'disabled',
      'WalletConnect init failed',
    );
  });
});
