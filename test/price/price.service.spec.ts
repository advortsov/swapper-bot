import { describe, expect, it, vi } from 'vitest';

import type { IPriceResponse } from '../../src/price/interfaces/price.interface';
import type { PriceQuoteService } from '../../src/price/price.quote.service';
import type { IPreparedPriceInput, IQuoteSelection } from '../../src/price/price.quote.types';
import type { PriceRuntimeService } from '../../src/price/price.runtime.service';
import { PriceService } from '../../src/price/price.service';
import type { UserSettingsService } from '../../src/settings/user-settings.service';

const preparedInput: IPreparedPriceInput = {
  chain: 'ethereum',
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
};

const quoteSelection: IQuoteSelection = {
  bestQuote: {
    aggregatorName: 'paraswap',
    toAmountBaseUnits: '1000000',
    grossToAmountBaseUnits: '1000000',
    feeAmountBaseUnits: '0',
    feeAmountSymbol: null,
    feeAmountDecimals: null,
    feeBps: 0,
    feeMode: 'disabled',
    feeType: 'no fee',
    feeDisplayLabel: 'no fee',
    feeAppliedAtQuote: false,
    feeEnforcedOnExecution: false,
    feeAssetSide: 'none',
    executionFee: {
      kind: 'none',
      aggregatorName: 'paraswap',
      chain: 'ethereum',
      mode: 'disabled',
      feeType: 'no fee',
      feeBps: 0,
      feeAssetSide: 'none',
      feeAssetAddress: null,
      feeAssetSymbol: null,
      feeAppliedAtQuote: false,
      feeEnforcedOnExecution: false,
    },
    estimatedGasUsd: null,
    totalNetworkFeeWei: null,
    rawQuote: {},
  },
  successfulQuotes: [],
  providersPolled: 1,
};

const response: IPriceResponse = {
  chain: 'ethereum',
  aggregator: 'paraswap',
  fromSymbol: 'ETH',
  toSymbol: 'USDC',
  fromTokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  toTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  fromAmount: '10',
  toAmount: '1',
  grossToAmount: '1',
  feeAmount: '0',
  feeAmountSymbol: null,
  feeBps: 0,
  feeMode: 'disabled',
  feeType: 'no fee',
  feeDisplayLabel: 'no fee',
  estimatedGasUsd: null,
  providersPolled: 1,
  providerQuotes: [],
};

describe('PriceService', () => {
  it('должен применять preferredAggregator из настроек и кешировать отдельным ключом', async () => {
    const quoteService: Pick<
      PriceQuoteService,
      'prepare' | 'fetchQuoteSelection' | 'buildResponse'
    > = {
      prepare: vi.fn().mockResolvedValue(preparedInput),
      fetchQuoteSelection: vi.fn().mockResolvedValue(quoteSelection),
      buildResponse: vi.fn().mockReturnValue(response),
    };
    const runtimeService: Pick<
      PriceRuntimeService,
      'getCached' | 'saveCached' | 'logSuccess' | 'logError'
    > = {
      getCached: vi.fn().mockReturnValue(null),
      saveCached: vi.fn(),
      logSuccess: vi.fn().mockResolvedValue(undefined),
      logError: vi.fn(),
    };
    const userSettingsService: Pick<UserSettingsService, 'getSettings'> = {
      getSettings: vi.fn().mockResolvedValue({
        slippage: 0.5,
        preferredAggregator: 'paraswap',
      }),
    };
    const service = new PriceService(
      quoteService as PriceQuoteService,
      runtimeService as PriceRuntimeService,
      userSettingsService as UserSettingsService,
    );

    const result = await service.getBestQuote({
      userId: '42',
      amount: '10',
      fromTokenInput: 'ETH',
      toTokenInput: 'USDC',
      chain: 'ethereum',
      rawCommand: '/price 10 ETH to USDC',
      explicitChain: false,
    });

    expect(result).toBe(response);
    expect(quoteService.fetchQuoteSelection).toHaveBeenCalledWith(preparedInput, 'paraswap');
    expect(runtimeService.getCached).toHaveBeenCalledWith('ethereum:ETH:USDC:10:paraswap');
    expect(runtimeService.saveCached).toHaveBeenCalledWith(
      'ethereum:ETH:USDC:10:paraswap',
      response,
    );
  });
});
