import { describe, expect, it, vi } from 'vitest';

import type { IQuoteSelection, IPreparedPriceInput } from '../../src/price/price.quote.service';
import type { PriceQuoteService } from '../../src/price/price.quote.service';
import type { UserSettingsService } from '../../src/settings/user-settings.service';
import type { SwapIntentService } from '../../src/swap/swap-intent.service';
import { SwapService } from '../../src/swap/swap.service';
import type { WalletConnectService } from '../../src/wallet-connect/wallet-connect.service';
import { createDisabledFeeConfig, createQuoteResponse } from '../support/fee.fixtures';

const preparedPriceInput: IPreparedPriceInput = {
  normalizedAmount: '10',
  cacheKey: 'ethereum:ETH:USDC:10',
  fromToken: {
    address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    symbol: 'ETH',
    decimals: 18,
    name: 'Ether',
    chain: 'ethereum',
  },
  toToken: {
    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    symbol: 'USDC',
    decimals: 6,
    name: 'USD Coin',
    chain: 'ethereum',
  },
  sellAmountBaseUnits: '10000000000000000000',
  chain: 'ethereum',
};

const quoteSelection: IQuoteSelection = {
  bestQuote: createQuoteResponse({
    aggregatorName: 'paraswap',
    chain: 'ethereum',
    toAmountBaseUnits: '20200000000',
    estimatedGasUsd: 0.23,
  }),
  successfulQuotes: [
    createQuoteResponse({
      aggregatorName: 'paraswap',
      chain: 'ethereum',
      toAmountBaseUnits: '20200000000',
      estimatedGasUsd: 0.23,
    }),
    createQuoteResponse({
      aggregatorName: '0x',
      chain: 'ethereum',
      toAmountBaseUnits: '20150000000',
      estimatedGasUsd: null,
    }),
  ],
  providersPolled: 2,
};

const priceResponse = {
  chain: 'ethereum' as const,
  aggregator: 'paraswap',
  fromSymbol: 'ETH',
  toSymbol: 'USDC',
  fromTokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  toTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  fromAmount: '10',
  toAmount: '20200',
  grossToAmount: '20200',
  feeAmount: '0',
  feeAmountSymbol: null,
  feeBps: 0,
  feeMode: 'disabled' as const,
  feeType: 'no fee' as const,
  feeDisplayLabel: 'no fee',
  estimatedGasUsd: 0.23,
  providersPolled: 2,
  providerQuotes: [
    {
      aggregator: 'paraswap',
      toAmount: '20200',
      grossToAmount: '20200',
      feeAmount: '0',
      feeAmountSymbol: null,
      feeBps: 0,
      feeMode: 'disabled' as const,
      feeType: 'no fee' as const,
      feeDisplayLabel: 'no fee',
      feeAppliedAtQuote: false,
      feeEnforcedOnExecution: false,
      estimatedGasUsd: 0.23,
    },
    {
      aggregator: '0x',
      toAmount: '20150',
      grossToAmount: '20150',
      feeAmount: '0',
      feeAmountSymbol: null,
      feeBps: 0,
      feeMode: 'disabled' as const,
      feeType: 'no fee' as const,
      feeDisplayLabel: 'no fee',
      feeAppliedAtQuote: false,
      feeEnforcedOnExecution: false,
      estimatedGasUsd: null,
    },
  ],
};

const userSettingsService = {
  getSettings: async () => ({
    slippage: 0.5,
    preferredAggregator: 'auto',
  }),
} as unknown as UserSettingsService;

describe('SwapService', () => {
  it('должен создавать persistent intent и возвращать opaque selection tokens', async () => {
    const priceQuoteService: Pick<
      PriceQuoteService,
      'prepare' | 'fetchQuoteSelection' | 'buildResponse'
    > = {
      prepare: async () => preparedPriceInput,
      fetchQuoteSelection: async () => quoteSelection,
      buildResponse: () => priceResponse,
    };
    const swapIntentService: Pick<SwapIntentService, 'createIntent' | 'attachSelectionTokens'> = {
      createIntent: async () => ({
        intentId: 'intent-id',
        quoteExpiresAt: '2026-03-02T00:05:00.000Z',
        selectionTokens: new Map([
          ['paraswap', 'tok-1'],
          ['0x', 'tok-2'],
        ]),
      }),
      attachSelectionTokens: (providerQuotes, selectionTokens) =>
        providerQuotes.map((quote) => {
          const selectionToken = selectionTokens.get(quote.aggregator);

          if (!selectionToken) {
            return quote;
          }

          return {
            ...quote,
            selectionToken,
          };
        }),
    };
    const service = new SwapService(
      priceQuoteService as PriceQuoteService,
      {} as WalletConnectService,
      userSettingsService,
      swapIntentService as SwapIntentService,
    );

    const result = await service.getSwapQuotes({
      userId: '123',
      amount: '10',
      fromTokenInput: 'ETH',
      toTokenInput: 'USDC',
      chain: 'ethereum',
      rawCommand: '/swap 10 ETH to USDC',
      explicitChain: false,
    });

    expect(result.intentId).toBe('intent-id');
    expect(result.quoteExpiresAt).toBe('2026-03-02T00:05:00.000Z');
    expect(result.providerQuotes[0]?.selectionToken).toBe('tok-1');
    expect(result.providerQuotes[1]?.selectionToken).toBe('tok-2');
  });

  it('должен создавать WC-сессию из выбранного selection token', async () => {
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
        sellAmountBaseUnits: preparedPriceInput.sellAmountBaseUnits,
        fromToken: preparedPriceInput.fromToken,
        toToken: preparedPriceInput.toToken,
        providerQuotes: [
          {
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
          },
        ],
      },
    };
    const attachProviderReference = vi.fn().mockResolvedValue(undefined);
    const swapIntentService: Pick<
      SwapIntentService,
      | 'consumeSelectionToken'
      | 'hashPayload'
      | 'createExecution'
      | 'markExecutionError'
      | 'attachProviderReference'
    > = {
      consumeSelectionToken: async () => consumedIntent,
      hashPayload: () => 'swap-hash',
      createExecution: async () => 'execution-id',
      markExecutionError: async () => undefined,
      attachProviderReference,
    };
    const walletConnectService: Pick<WalletConnectService, 'createSession'> = {
      createSession: async (input) => {
        expect(input.swapPayload.executionId).toBe('execution-id');
        expect(input.swapPayload.executionFee.kind).toBe('none');
        expect(input.swapPayload.intentId).toBe('intent-id');
        return {
          sessionId: 'session-id',
          uri: 'wc:test',
          expiresAt: '2026-03-02T00:10:00.000Z',
          walletDelivery: 'qr',
        };
      },
    };
    const service = new SwapService(
      {} as PriceQuoteService,
      walletConnectService as WalletConnectService,
      userSettingsService,
      swapIntentService as SwapIntentService,
    );

    const result = await service.createSwapSessionFromSelection('123', 'tok-1');

    expect(result.intentId).toBe('intent-id');
    expect(result.aggregator).toBe('paraswap');
    expect(result.walletConnectUri).toBe('wc:test');
    expect(result.quoteExpiresAt).toBe('2026-03-02T00:05:00.000Z');
    expect(attachProviderReference).toHaveBeenCalledWith('execution-id', 'session-id');
  });

  it('должен помечать execution как error, если WC-сессия не создалась', async () => {
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
        sellAmountBaseUnits: preparedPriceInput.sellAmountBaseUnits,
        fromToken: preparedPriceInput.fromToken,
        toToken: preparedPriceInput.toToken,
        providerQuotes: [
          {
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
          },
        ],
      },
    };
    const markExecutionError = vi.fn().mockResolvedValue(undefined);
    const swapIntentService: Pick<
      SwapIntentService,
      | 'consumeSelectionToken'
      | 'hashPayload'
      | 'createExecution'
      | 'markExecutionError'
      | 'attachProviderReference'
    > = {
      consumeSelectionToken: async () => consumedIntent,
      hashPayload: () => 'swap-hash',
      createExecution: async () => 'execution-id',
      markExecutionError,
      attachProviderReference: async () => undefined,
    };
    const walletConnectService: Pick<WalletConnectService, 'createSession'> = {
      createSession: async () => {
        throw new Error('WalletConnect init failed');
      },
    };
    const service = new SwapService(
      {} as PriceQuoteService,
      walletConnectService as WalletConnectService,
      userSettingsService,
      swapIntentService as SwapIntentService,
    );

    await expect(service.createSwapSessionFromSelection('123', 'tok-1')).rejects.toThrowError(
      'WalletConnect init failed',
    );
    expect(markExecutionError).toHaveBeenCalledWith(
      'execution-id',
      'paraswap',
      'disabled',
      'WalletConnect init failed',
    );
  });
});
