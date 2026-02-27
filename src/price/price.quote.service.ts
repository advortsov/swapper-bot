import { Inject, Injectable } from '@nestjs/common';
import { formatUnits, parseUnits } from 'viem';

import { AGGREGATORS_TOKEN } from '../aggregators/aggregators.constants';
import type { IAggregator, IQuoteResponse } from '../aggregators/interfaces/aggregator.interface';
import { CHAINS_TOKEN, type IChainsCollection } from '../chains/chains.constants';
import type { ChainType, IChain } from '../chains/interfaces/chain.interface';
import { BusinessException } from '../common/exceptions/business.exception';
import { TokensService } from '../tokens/tokens.service';
import type { IPriceRequest, IPriceResponse } from './interfaces/price.interface';
import type { ITokenRecord } from '../tokens/tokens.repository';

export interface IQuoteSelection {
  bestQuote: IQuoteResponse;
  successfulQuotes: readonly IQuoteResponse[];
  providersPolled: number;
}

export interface IPreparedPriceInput {
  chain: ChainType;
  normalizedAmount: string;
  cacheKey: string;
  fromToken: ITokenRecord;
  toToken: ITokenRecord;
  sellAmountBaseUnits: string;
}

@Injectable()
export class PriceQuoteService {
  public constructor(
    @Inject(AGGREGATORS_TOKEN)
    private readonly aggregators: readonly IAggregator[],
    private readonly tokensService: TokensService,
    @Inject(CHAINS_TOKEN)
    private readonly chains: IChainsCollection,
  ) {}

  public async prepare(request: IPriceRequest): Promise<IPreparedPriceInput> {
    const normalizedAmount = this.normalizeAmount(request.amount);
    const chain = this.resolveChain(request.chain);
    const fromToken = await this.tokensService.getTokenBySymbol(request.fromSymbol, request.chain);
    const toToken = await this.tokensService.getTokenBySymbol(request.toSymbol, request.chain);

    this.ensureSupportedPair(chain, fromToken.address, toToken.address);

    return {
      chain: request.chain,
      normalizedAmount,
      cacheKey: this.buildCacheKey(
        request.chain,
        normalizedAmount,
        fromToken.symbol,
        toToken.symbol,
      ),
      fromToken,
      toToken,
      sellAmountBaseUnits: parseUnits(normalizedAmount, fromToken.decimals).toString(),
    };
  }

  public async fetchQuoteSelection(input: IPreparedPriceInput): Promise<IQuoteSelection> {
    const chainAggregators = this.aggregators.filter((aggregator) =>
      aggregator.supportedChains.includes(input.chain),
    );

    if (chainAggregators.length === 0) {
      throw new BusinessException(`No aggregators configured for chain ${input.chain}`);
    }

    const settledQuotes = await Promise.allSettled(
      chainAggregators.map(async (aggregator) =>
        aggregator.getQuote({
          chain: input.chain,
          sellTokenAddress: input.fromToken.address,
          buyTokenAddress: input.toToken.address,
          sellAmountBaseUnits: input.sellAmountBaseUnits,
          sellTokenDecimals: input.fromToken.decimals,
          buyTokenDecimals: input.toToken.decimals,
        }),
      ),
    );

    const quotes = settledQuotes.flatMap((result) => {
      if (result.status === 'fulfilled') {
        return [result.value];
      }

      return [];
    });

    if (quotes.length === 0) {
      throw new BusinessException('Failed to get quotes from all aggregators');
    }

    const bestQuote = quotes.reduce((currentBestQuote, currentQuote) => {
      if (BigInt(currentQuote.toAmountBaseUnits) > BigInt(currentBestQuote.toAmountBaseUnits)) {
        return currentQuote;
      }

      return currentBestQuote;
    });

    return {
      bestQuote,
      successfulQuotes: quotes,
      providersPolled: chainAggregators.length,
    };
  }

  public buildResponse(input: IPreparedPriceInput, selection: IQuoteSelection): IPriceResponse {
    const providerQuotes = selection.successfulQuotes.map((quote) => ({
      aggregator: quote.aggregatorName,
      toAmount: formatUnits(BigInt(quote.toAmountBaseUnits), input.toToken.decimals),
      estimatedGasUsd: quote.estimatedGasUsd,
    }));

    return {
      chain: input.chain,
      aggregator: selection.bestQuote.aggregatorName,
      fromSymbol: input.fromToken.symbol,
      toSymbol: input.toToken.symbol,
      fromAmount: input.normalizedAmount,
      toAmount: formatUnits(BigInt(selection.bestQuote.toAmountBaseUnits), input.toToken.decimals),
      estimatedGasUsd: selection.bestQuote.estimatedGasUsd,
      providersPolled: selection.providersPolled,
      providerQuotes,
    };
  }

  private normalizeAmount(amount: string): string {
    const parsedAmount = Number.parseFloat(amount);

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new BusinessException('Amount must be a positive number');
    }

    return amount.trim();
  }

  private buildCacheKey(
    chain: ChainType,
    amount: string,
    fromSymbol: string,
    toSymbol: string,
  ): string {
    return `${chain}:${fromSymbol}:${toSymbol}:${amount}`;
  }

  private ensureSupportedPair(chain: IChain, fromAddress: string, toAddress: string): void {
    if (!chain.validateAddress(fromAddress)) {
      throw new BusinessException(`Invalid from token address: ${fromAddress}`);
    }

    if (!chain.validateAddress(toAddress)) {
      throw new BusinessException(`Invalid to token address: ${toAddress}`);
    }
  }

  private resolveChain(chainName: ChainType): IChain {
    const chain = this.chains.find((candidateChain) => candidateChain.name === chainName);

    if (!chain) {
      throw new BusinessException(`Chain ${chainName} is not supported`);
    }

    return chain;
  }
}
