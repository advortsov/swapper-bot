import { describe, expect, it } from 'vitest';

import type { IQuoteResponse } from '../../src/aggregators/interfaces/aggregator.interface';
import type { ChainType } from '../../src/chains/interfaces/chain.interface';
import type { IPriceRequest } from '../../src/price/interfaces/price.interface';
import type { IPreparedPriceInput, IQuoteSelection } from '../../src/price/price.quote.service';
import type { PriceQuoteService } from '../../src/price/price.quote.service';
import { SwapService } from '../../src/swap/swap.service';
import type { WalletConnectService } from '../../src/wallet-connect/wallet-connect.service';

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

const quoteResponse: IQuoteResponse = {
  aggregatorName: 'paraswap',
  toAmountBaseUnits: '20200000000',
  estimatedGasUsd: 0.23,
  totalNetworkFeeWei: null,
  rawQuote: {},
};

const quoteSelection: IQuoteSelection = {
  bestQuote: quoteResponse,
  successfulQuotes: [
    quoteResponse,
    {
      aggregatorName: '0x',
      toAmountBaseUnits: '20150000000',
      estimatedGasUsd: null,
      totalNetworkFeeWei: null,
      rawQuote: {},
    },
  ],
  providersPolled: 2,
};

describe('SwapService', () => {
  it('должен создавать swap-сессию c WalletConnect URI', async () => {
    const preparedRequests: IPriceRequest[] = [];
    const sessionPayloads: {
      chain: ChainType;
      sellTokenDecimals: number;
      buyTokenDecimals: number;
    }[] = [];
    const priceQuoteService: Pick<
      PriceQuoteService,
      'prepare' | 'fetchQuoteSelection' | 'buildResponse'
    > = {
      prepare: async (request: IPriceRequest): Promise<IPreparedPriceInput> => {
        preparedRequests.push(request);
        return preparedPriceInput;
      },
      fetchQuoteSelection: async (): Promise<IQuoteSelection> => quoteSelection,
      buildResponse: () => ({
        chain: 'ethereum',
        aggregator: 'paraswap',
        fromSymbol: 'ETH',
        toSymbol: 'USDC',
        fromAmount: '10',
        toAmount: '20200',
        estimatedGasUsd: 0.23,
        providersPolled: 2,
        providerQuotes: [
          { aggregator: 'paraswap', toAmount: '20200', estimatedGasUsd: 0.23 },
          { aggregator: '0x', toAmount: '20150', estimatedGasUsd: null },
        ],
      }),
    };
    const walletConnectService: Pick<WalletConnectService, 'createSession'> = {
      createSession: async (input) => {
        sessionPayloads.push({
          chain: input.swapPayload.chain,
          sellTokenDecimals: input.swapPayload.sellTokenDecimals,
          buyTokenDecimals: input.swapPayload.buyTokenDecimals,
        });

        return {
          sessionId: 'session-id',
          uri: 'wc:test',
          expiresAt: '2026-02-27T00:00:00.000Z',
        };
      },
    };
    const service = new SwapService(
      priceQuoteService as PriceQuoteService,
      walletConnectService as WalletConnectService,
    );

    const result = await service.createSwapSession({
      userId: '123',
      amount: '10',
      fromSymbol: 'ETH',
      toSymbol: 'USDC',
      chain: 'ethereum',
      rawCommand: '/swap 10 ETH to USDC',
    });

    expect(preparedRequests).toHaveLength(1);
    expect(preparedRequests[0]?.chain).toBe('ethereum');
    expect(sessionPayloads).toEqual([
      {
        chain: 'ethereum',
        sellTokenDecimals: 18,
        buyTokenDecimals: 6,
      },
    ]);
    expect(result.aggregator).toBe('paraswap');
    expect(result.providersPolled).toBe(2);
    expect(result.providerQuotes).toHaveLength(2);
    expect(result.sessionId).toBe('session-id');
    expect(result.walletConnectUri).toBe('wc:test');
  });

  it('должен создавать swap-сессию в сети solana через WalletConnect', async () => {
    const priceQuoteService: Pick<
      PriceQuoteService,
      'prepare' | 'fetchQuoteSelection' | 'buildResponse'
    > = {
      prepare: async (): Promise<IPreparedPriceInput> => ({
        ...preparedPriceInput,
        chain: 'solana',
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
      }),
      fetchQuoteSelection: async (): Promise<IQuoteSelection> => quoteSelection,
      buildResponse: () => ({
        chain: 'solana',
        aggregator: 'jupiter',
        fromSymbol: 'SOL',
        toSymbol: 'USDC',
        fromAmount: '1',
        toAmount: '150',
        estimatedGasUsd: null,
        providersPolled: 1,
        providerQuotes: [{ aggregator: 'jupiter', toAmount: '150', estimatedGasUsd: null }],
      }),
    };
    const createdSessions: { chain: ChainType }[] = [];
    const walletConnectService: Pick<WalletConnectService, 'createSession'> = {
      createSession: async (input) => {
        createdSessions.push({ chain: input.swapPayload.chain });
        return {
          sessionId: 'session-id',
          uri: 'wc:test-solana',
          expiresAt: '2026-02-27T00:00:00.000Z',
        };
      },
    };
    const service = new SwapService(
      priceQuoteService as PriceQuoteService,
      walletConnectService as WalletConnectService,
    );

    const result = await service.createSwapSession({
      userId: '123',
      amount: '1',
      fromSymbol: 'SOL',
      toSymbol: 'USDC',
      chain: 'solana',
      rawCommand: '/swap 1 SOL to USDC on solana',
    });

    expect(createdSessions).toEqual([{ chain: 'solana' }]);
    expect(result.walletConnectUri).toBe('wc:test-solana');
    expect(result.chain).toBe('solana');
    expect(result.aggregator).toBe('jupiter');
  });
});
