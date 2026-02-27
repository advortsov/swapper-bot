import { describe, expect, it } from 'vitest';

import type {
  IAggregator,
  IQuoteRequest,
  IQuoteResponse,
  ISwapRequest,
  ISwapTransaction,
} from '../../src/aggregators/interfaces/aggregator.interface';
import type { EthereumChain } from '../../src/chains/ethereum/ethereum.chain';
import type { ChainType } from '../../src/chains/interfaces/chain.interface';
import type { IPriceRequest } from '../../src/price/interfaces/price.interface';
import { PriceQuoteService } from '../../src/price/price.quote.service';
import type { ITokenRecord } from '../../src/tokens/tokens.repository';
import type { TokensService } from '../../src/tokens/tokens.service';

const FROM_TOKEN: ITokenRecord = {
  address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  symbol: 'ETH',
  decimals: 18,
  name: 'Ether',
  chain: 'ethereum',
};

const TO_TOKEN: ITokenRecord = {
  address: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  symbol: 'USDC',
  decimals: 6,
  name: 'USD Coin',
  chain: 'ethereum',
};

interface IFakeAggregatorOptions {
  name: string;
  toAmountBaseUnits: string;
  supportedChains?: readonly ChainType[];
  throwsError?: boolean;
}

class FakeAggregator implements IAggregator {
  public readonly name: string;
  public readonly supportedChains: readonly ChainType[];
  public calls: number = 0;
  private readonly toAmountBaseUnits: string;
  private readonly throwsError: boolean;

  public constructor(options: IFakeAggregatorOptions) {
    this.name = options.name;
    this.toAmountBaseUnits = options.toAmountBaseUnits;
    this.supportedChains = options.supportedChains ?? ['ethereum'];
    this.throwsError = options.throwsError ?? false;
  }

  public async getQuote(_params: IQuoteRequest): Promise<IQuoteResponse> {
    this.calls += 1;

    if (this.throwsError) {
      throw new Error(`${this.name} failed`);
    }

    return {
      aggregatorName: this.name,
      toAmountBaseUnits: this.toAmountBaseUnits,
      estimatedGasUsd: null,
      totalNetworkFeeWei: null,
      rawQuote: {},
    };
  }

  public async buildSwapTransaction(_params: ISwapRequest): Promise<ISwapTransaction> {
    return {
      to: '',
      data: '',
      value: '0',
    };
  }

  public async healthCheck(): Promise<boolean> {
    return true;
  }
}

const priceRequest: IPriceRequest = {
  userId: 'user-1',
  amount: '10',
  fromSymbol: 'ETH',
  toSymbol: 'USDC',
  rawCommand: '/price 10 ETH to USDC',
};

function createService(aggregators: readonly IAggregator[]): PriceQuoteService {
  const tokensService: Pick<TokensService, 'getTokenBySymbol'> = {
    getTokenBySymbol: async (symbol: string): Promise<ITokenRecord> => {
      if (symbol === FROM_TOKEN.symbol) {
        return FROM_TOKEN;
      }

      return TO_TOKEN;
    },
  };

  const ethereumChain: Pick<EthereumChain, 'validateAddress'> = {
    validateAddress: (_address: string): boolean => true,
  };

  return new PriceQuoteService(
    aggregators,
    tokensService as TokensService,
    ethereumChain as EthereumChain,
  );
}

describe('PriceQuoteService', () => {
  it('должен выбрать лучший курс по максимальному toAmount', async () => {
    const zeroX = new FakeAggregator({
      name: '0x',
      toAmountBaseUnits: '10000000',
    });
    const paraSwap = new FakeAggregator({
      name: 'paraswap',
      toAmountBaseUnits: '10500000',
    });
    const service = createService([zeroX, paraSwap]);

    const preparedInput = await service.prepare(priceRequest);
    const selection = await service.fetchQuoteSelection(preparedInput);

    expect(selection.bestQuote.aggregatorName).toBe('paraswap');
    expect(selection.bestQuote.toAmountBaseUnits).toBe('10500000');
    expect(selection.providersPolled).toBe(2);
    expect(selection.successfulQuotes).toHaveLength(2);
    expect(zeroX.calls).toBe(1);
    expect(paraSwap.calls).toBe(1);
  });

  it('должен выбрасывать ошибку при отсутствии агрегаторов для сети', async () => {
    const disabledAggregator = new FakeAggregator({
      name: 'disabled',
      toAmountBaseUnits: '1',
      supportedChains: [],
    });
    const service = createService([disabledAggregator]);
    const preparedInput = await service.prepare(priceRequest);

    await expect(service.fetchQuoteSelection(preparedInput)).rejects.toThrowError(
      'No aggregators configured for chain ethereum',
    );
  });

  it('должен отдавать успешную котировку, если один агрегатор упал', async () => {
    const failedZeroX = new FakeAggregator({
      name: '0x',
      toAmountBaseUnits: '10000000',
      throwsError: true,
    });
    const paraSwap = new FakeAggregator({
      name: 'paraswap',
      toAmountBaseUnits: '9900000',
    });
    const service = createService([failedZeroX, paraSwap]);
    const preparedInput = await service.prepare(priceRequest);

    const selection = await service.fetchQuoteSelection(preparedInput);

    expect(selection.bestQuote.aggregatorName).toBe('paraswap');
    expect(selection.successfulQuotes).toHaveLength(1);
    expect(failedZeroX.calls).toBe(1);
    expect(paraSwap.calls).toBe(1);
  });

  it('должен выбрасывать ошибку, если все агрегаторы упали', async () => {
    const failedZeroX = new FakeAggregator({
      name: '0x',
      toAmountBaseUnits: '1',
      throwsError: true,
    });
    const failedParaSwap = new FakeAggregator({
      name: 'paraswap',
      toAmountBaseUnits: '1',
      throwsError: true,
    });
    const service = createService([failedZeroX, failedParaSwap]);
    const preparedInput = await service.prepare(priceRequest);

    await expect(service.fetchQuoteSelection(preparedInput)).rejects.toThrowError(
      'Failed to get quotes from all aggregators',
    );
  });
});
