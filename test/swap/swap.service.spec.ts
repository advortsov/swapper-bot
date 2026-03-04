import { describe, expect, it, vi } from 'vitest';

import type { UserSettingsService } from '../../src/settings/user-settings.service';
import type { SwapIntentService } from '../../src/swap/swap-intent.service';
import type { SwapExpirationService } from '../../src/swap/swap.expiration.service';
import type { SwapQuotesService } from '../../src/swap/swap.quotes.service';
import type { SwapSelectionService } from '../../src/swap/swap.selection.service';
import { SwapService } from '../../src/swap/swap.service';
import type { SwapSessionService } from '../../src/swap/swap.session.service';
import { createDisabledFeeConfig } from '../support/fee.fixtures';

const consumedIntent = {
  intentId: 'intent-id',
  userId: '123',
  chain: 'ethereum' as const,
  rawCommand: '/swap 10 ETH to USDC',
  aggregator: 'paraswap',
  quoteExpiresAt: new Date('2026-03-02T00:05:00.000Z'),
  quoteSnapshot: {
    chain: 'ethereum' as const,
    normalizedAmount: '10',
    sellAmountBaseUnits: '10000000000000000000',
    fromToken: {
      address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      symbol: 'ETH',
      decimals: 18,
      name: 'Ether',
      chain: 'ethereum' as const,
    },
    toToken: {
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
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
  grossToAmountBaseUnits: '20200000000',
  netToAmountBaseUnits: '20200000000',
  feeAmountBaseUnits: '0',
  feeAmountSymbol: null,
  feeAmountDecimals: null,
  feeBps: 0,
  feeMode: 'disabled' as const,
  feeType: 'no fee' as const,
  feeDisplayLabel: 'no fee',
  feeAppliedAtQuote: false,
  feeEnforcedOnExecution: false,
  feeAssetSide: 'none' as const,
  executionFee: createDisabledFeeConfig('paraswap', 'ethereum'),
  estimatedGasUsd: 0.23,
  totalNetworkFeeWei: null,
  rawQuoteHash: 'quote-hash',
};

describe('SwapService', () => {
  it('должен делегировать получение котировок в SwapQuotesService', async () => {
    const expectedResponse = {
      intentId: 'intent-id',
      chain: 'ethereum' as const,
      aggregator: 'paraswap',
      fromSymbol: 'ETH',
      toSymbol: 'USDC',
      fromTokenAddress: '0x1',
      toTokenAddress: '0x2',
      fromAmount: '10',
      toAmount: '20200',
      grossToAmount: '20200',
      feeAmount: '0',
      feeAmountSymbol: null,
      feeBps: 0,
      feeMode: 'disabled' as const,
      feeType: 'no fee' as const,
      feeDisplayLabel: 'no fee',
      providersPolled: 2,
      quoteExpiresAt: '2026-03-02T00:05:00.000Z',
      providerQuotes: [],
    };
    const swapQuotesService: Pick<SwapQuotesService, 'getSwapQuotes'> = {
      getSwapQuotes: vi.fn().mockResolvedValue(expectedResponse),
    };
    const service = new SwapService(
      swapQuotesService as SwapQuotesService,
      {} as UserSettingsService,
      {} as SwapSelectionService,
      {} as SwapSessionService,
    );
    Object.assign(service, {
      swapIntentService: {} as SwapIntentService,
      swapExpirationService: {} as SwapExpirationService,
    });

    const result = await service.getSwapQuotes({
      userId: '123',
      amount: '10',
      fromTokenInput: 'ETH',
      toTokenInput: 'USDC',
      chain: 'ethereum',
      rawCommand: '/swap 10 ETH to USDC',
      explicitChain: false,
    });

    expect(result).toEqual(expectedResponse);
    expect(swapQuotesService.getSwapQuotes).toHaveBeenCalledOnce();
  });

  it('должен создавать WC-сессию из выбранного selection token', async () => {
    const attachProviderReference = vi.fn().mockResolvedValue(undefined);
    const swapIntentService: Pick<SwapIntentService, 'consumeSelectionToken'> = {
      consumeSelectionToken: vi.fn().mockResolvedValue(consumedIntent),
    };
    const userSettingsService: Pick<UserSettingsService, 'getSettings'> = {
      getSettings: vi.fn().mockResolvedValue({
        slippage: 0.5,
        preferredAggregator: 'auto',
      }),
    };
    const swapSelectionService: Pick<SwapSelectionService, 'getSelectedQuote' | 'createExecution'> =
      {
        getSelectedQuote: vi.fn().mockReturnValue(selectedQuote),
        createExecution: vi.fn().mockResolvedValue('execution-id'),
      };
    const walletConnectSession = {
      sessionId: 'session-id',
      uri: 'wc:test',
      expiresAt: '2026-03-02T00:10:00.000Z',
      walletDelivery: 'qr' as const,
    };
    const expectedResponse = {
      intentId: 'intent-id',
      chain: 'ethereum' as const,
      aggregator: 'paraswap',
      fromSymbol: 'ETH',
      toSymbol: 'USDC',
      fromAmount: '10',
      toAmount: '20200',
      grossToAmount: '20200',
      feeAmount: '0',
      feeAmountSymbol: null,
      feeBps: 0,
      feeMode: 'disabled' as const,
      feeType: 'no fee' as const,
      feeDisplayLabel: 'no fee',
      walletConnectUri: 'wc:test',
      sessionId: 'session-id',
      expiresAt: '2026-03-02T00:10:00.000Z',
      quoteExpiresAt: '2026-03-02T00:05:00.000Z',
      walletDelivery: 'qr' as const,
    };
    const swapSessionService: Pick<
      SwapSessionService,
      'createWalletConnectSession' | 'attachProviderReference' | 'buildResponse'
    > = {
      createWalletConnectSession: vi.fn().mockResolvedValue(walletConnectSession),
      attachProviderReference,
      buildResponse: vi.fn().mockReturnValue(expectedResponse),
    };
    const swapExpirationService: Pick<
      SwapExpirationService,
      'resolveSlippage' | 'formatQuoteExpiresAt'
    > = {
      resolveSlippage: vi.fn().mockReturnValue(0.5),
      formatQuoteExpiresAt: vi.fn().mockReturnValue('2026-03-02T00:05:00.000Z'),
    };
    const service = new SwapService(
      {} as SwapQuotesService,
      userSettingsService as UserSettingsService,
      swapSelectionService as SwapSelectionService,
      swapSessionService as SwapSessionService,
    );
    Object.assign(service, {
      swapIntentService,
      swapExpirationService,
    });

    const result = await service.createSwapSessionFromSelection('123', 'tok-1');

    expect(result).toEqual(expectedResponse);
    expect(swapIntentService.consumeSelectionToken).toHaveBeenCalledWith('123', 'tok-1');
    expect(swapSelectionService.createExecution).toHaveBeenCalledWith({
      consumedIntent,
      selectedQuote,
      slippage: 0.5,
    });
    expect(swapSessionService.createWalletConnectSession).toHaveBeenCalledWith({
      userId: '123',
      executionId: 'execution-id',
      slippage: 0.5,
      consumedIntent,
      selectedQuote,
    });
    expect(attachProviderReference).toHaveBeenCalledWith('execution-id', 'session-id');
  });
});
