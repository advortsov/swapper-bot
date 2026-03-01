import { describe, expect, it, vi } from 'vitest';

import { QuoteMonetizationService } from '../../src/fees/quote-monetization.service';
import { createQuoteResponse } from '../support/fee.fixtures';

const FROM_TOKEN = {
  address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  symbol: 'ETH',
  decimals: 18,
  name: 'Ether',
  chain: 'ethereum' as const,
};

const TO_TOKEN = {
  address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  symbol: 'USDC',
  decimals: 6,
  name: 'USD Coin',
  chain: 'ethereum' as const,
};

describe('QuoteMonetizationService', () => {
  it('должен вычитать buy-side fee из net output', () => {
    const service = new QuoteMonetizationService(
      {
        incrementSwapFeeQuote: vi.fn(),
        addExpectedFeeAmount: vi.fn(),
        incrementSwapFeeMissingConfiguration: vi.fn(),
      } as never,
      {
        getPolicy: vi.fn(),
      } as never,
    );
    const quote = createQuoteResponse({
      aggregatorName: '0x',
      chain: 'ethereum',
      toAmountBaseUnits: '1000000',
      estimatedGasUsd: null,
    });

    const monetized = service.applyPolicy({
      rawQuote: quote,
      feePolicy: {
        aggregatorName: '0x',
        chain: 'ethereum',
        mode: 'enforced',
        feeType: 'native fee',
        feeBps: 100,
        displayLabel: 'native fee',
        isEnabled: true,
        executionFee: {
          kind: 'zerox',
          aggregatorName: '0x',
          chain: 'ethereum',
          mode: 'enforced',
          feeType: 'native fee',
          feeBps: 100,
          feeAssetSide: 'buy',
          feeAssetAddress: TO_TOKEN.address,
          feeAssetSymbol: TO_TOKEN.symbol,
          feeAppliedAtQuote: true,
          feeEnforcedOnExecution: true,
          feeRecipient: '0x1111111111111111111111111111111111111111',
          feeTokenAddress: TO_TOKEN.address,
        },
      },
      fromToken: FROM_TOKEN,
      toToken: TO_TOKEN,
      sellAmountBaseUnits: '1000000000000000000',
    });

    expect(monetized.grossToAmountBaseUnits).toBe('1000000');
    expect(monetized.feeAmountBaseUnits).toBe('10000');
    expect(monetized.toAmountBaseUnits).toBe('990000');
  });

  it('должен не менять net output при sell-side fee', () => {
    const service = new QuoteMonetizationService(
      {
        incrementSwapFeeQuote: vi.fn(),
        addExpectedFeeAmount: vi.fn(),
        incrementSwapFeeMissingConfiguration: vi.fn(),
      } as never,
      {
        getPolicy: vi.fn(),
      } as never,
    );
    const quote = createQuoteResponse({
      aggregatorName: 'jupiter',
      chain: 'solana',
      toAmountBaseUnits: '150000000',
      estimatedGasUsd: null,
    });

    const monetized = service.applyPolicy({
      rawQuote: quote,
      feePolicy: {
        aggregatorName: 'jupiter',
        chain: 'solana',
        mode: 'enforced',
        feeType: 'native fee',
        feeBps: 20,
        displayLabel: 'native fee',
        isEnabled: true,
        executionFee: {
          kind: 'jupiter',
          aggregatorName: 'jupiter',
          chain: 'solana',
          mode: 'enforced',
          feeType: 'native fee',
          feeBps: 20,
          feeAssetSide: 'sell',
          feeAssetAddress: 'So11111111111111111111111111111111111111112',
          feeAssetSymbol: 'SOL',
          feeAppliedAtQuote: true,
          feeEnforcedOnExecution: true,
          feeAccount: 'fee-account',
          feeMintAddress: 'So11111111111111111111111111111111111111112',
        },
      },
      fromToken: {
        address: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
        decimals: 9,
        name: 'Solana',
        chain: 'solana',
      },
      toToken: {
        address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        symbol: 'USDC',
        decimals: 6,
        name: 'USD Coin',
        chain: 'solana',
      },
      sellAmountBaseUnits: '1000000000',
    });

    expect(monetized.toAmountBaseUnits).toBe('150000000');
    expect(monetized.feeAmountSymbol).toBe('SOL');
    expect(monetized.feeAmountBaseUnits).toBe('2000000');
  });
});
