import { Inject, Injectable } from '@nestjs/common';
import { formatUnits, parseUnits } from 'viem';

import { AGGREGATORS_TOKEN } from '../aggregators/aggregators.constants';
import type { IAggregator, IQuoteResponse } from '../aggregators/interfaces/aggregator.interface';
import { CHAINS_TOKEN, type IChainsCollection } from '../chains/chains.constants';
import type { ChainType, IChain } from '../chains/interfaces/chain.interface';
import { BusinessException } from '../common/exceptions/business.exception';
import { QuoteMonetizationService } from '../fees/quote-monetization.service';
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

const AGGREGATOR_PRIORITY: Readonly<Record<string, number>> = {
  '0x': 0,
  paraswap: 1,
  odos: 2,
  jupiter: 3,
};

@Injectable()
export class PriceQuoteService {
  public constructor(
    @Inject(AGGREGATORS_TOKEN)
    private readonly aggregators: readonly IAggregator[],
    private readonly tokensService: TokensService,
    @Inject(CHAINS_TOKEN)
    private readonly chains: IChainsCollection,
    private readonly quoteMonetizationService: QuoteMonetizationService,
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

  public async fetchQuoteSelection(
    input: IPreparedPriceInput,
    preferredAggregator?: string,
  ): Promise<IQuoteSelection> {
    const chainAggregators = this.aggregators.filter((aggregator) =>
      aggregator.supportedChains.includes(input.chain),
    );

    if (chainAggregators.length === 0) {
      throw new BusinessException(`No aggregators configured for chain ${input.chain}`);
    }

    const aggregatorsToQuery = this.filterByPreference(
      chainAggregators,
      input.chain,
      preferredAggregator,
    );

    const settledQuotes = await Promise.allSettled(
      aggregatorsToQuery.map(async (aggregator) => this.fetchAggregatorQuote(aggregator, input)),
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

    const sortedQuotes = [...quotes].sort((leftQuote, rightQuote) =>
      this.compareQuotes(leftQuote, rightQuote),
    );
    const bestQuote = sortedQuotes[0];

    if (!bestQuote) {
      throw new BusinessException('Best quote is not available');
    }

    return {
      bestQuote,
      successfulQuotes: sortedQuotes,
      providersPolled: aggregatorsToQuery.length,
    };
  }

  private filterByPreference(
    chainAggregators: readonly IAggregator[],
    chain: ChainType,
    preferredAggregator?: string,
  ): readonly IAggregator[] {
    if (!preferredAggregator || preferredAggregator === 'auto') {
      return chainAggregators;
    }

    const normalizedPreference = preferredAggregator === 'zerox' ? '0x' : preferredAggregator;
    const preferred = chainAggregators.filter(
      (aggregator) => aggregator.name === normalizedPreference,
    );

    if (preferred.length === 0) {
      throw new BusinessException(
        `Aggregator ${preferredAggregator} is not configured for chain ${chain}`,
      );
    }

    return preferred;
  }

  public buildResponse(input: IPreparedPriceInput, selection: IQuoteSelection): IPriceResponse {
    const providerQuotes = selection.successfulQuotes.map((quote) => ({
      aggregator: quote.aggregatorName,
      toAmount: formatUnits(BigInt(quote.toAmountBaseUnits), input.toToken.decimals),
      grossToAmount: formatUnits(BigInt(quote.grossToAmountBaseUnits), input.toToken.decimals),
      feeAmount: this.formatFeeAmount(quote),
      feeAmountSymbol: quote.feeAmountSymbol,
      feeBps: quote.feeBps,
      feeMode: quote.feeMode,
      feeType: quote.feeType,
      feeDisplayLabel: quote.feeDisplayLabel,
      feeAppliedAtQuote: quote.feeAppliedAtQuote,
      feeEnforcedOnExecution: quote.feeEnforcedOnExecution,
      estimatedGasUsd: quote.estimatedGasUsd,
    }));

    return {
      chain: input.chain,
      aggregator: selection.bestQuote.aggregatorName,
      fromSymbol: input.fromToken.symbol,
      toSymbol: input.toToken.symbol,
      fromAmount: input.normalizedAmount,
      toAmount: formatUnits(BigInt(selection.bestQuote.toAmountBaseUnits), input.toToken.decimals),
      grossToAmount: formatUnits(
        BigInt(selection.bestQuote.grossToAmountBaseUnits),
        input.toToken.decimals,
      ),
      feeAmount: this.formatFeeAmount(selection.bestQuote),
      feeAmountSymbol: selection.bestQuote.feeAmountSymbol,
      feeBps: selection.bestQuote.feeBps,
      feeMode: selection.bestQuote.feeMode,
      feeType: selection.bestQuote.feeType,
      feeDisplayLabel: selection.bestQuote.feeDisplayLabel,
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

  private async fetchAggregatorQuote(
    aggregator: IAggregator,
    input: IPreparedPriceInput,
  ): Promise<IQuoteResponse> {
    const feePolicy = this.quoteMonetizationService.getPolicy(
      aggregator.name,
      input.chain,
      input.fromToken,
      input.toToken,
    );
    const rawQuote = await aggregator.getQuote({
      chain: input.chain,
      sellTokenAddress: input.fromToken.address,
      buyTokenAddress: input.toToken.address,
      sellAmountBaseUnits: input.sellAmountBaseUnits,
      sellTokenDecimals: input.fromToken.decimals,
      buyTokenDecimals: input.toToken.decimals,
      feeConfig: feePolicy.executionFee,
    });

    return this.quoteMonetizationService.applyPolicy({
      rawQuote,
      feePolicy,
      fromToken: input.fromToken,
      toToken: input.toToken,
      sellAmountBaseUnits: input.sellAmountBaseUnits,
    });
  }

  private compareQuotes(leftQuote: IQuoteResponse, rightQuote: IQuoteResponse): number {
    const leftAmount = BigInt(leftQuote.toAmountBaseUnits);
    const rightAmount = BigInt(rightQuote.toAmountBaseUnits);

    if (leftAmount > rightAmount) {
      return -1;
    }

    if (leftAmount < rightAmount) {
      return 1;
    }

    const leftGas = leftQuote.estimatedGasUsd ?? Number.POSITIVE_INFINITY;
    const rightGas = rightQuote.estimatedGasUsd ?? Number.POSITIVE_INFINITY;

    if (leftGas < rightGas) {
      return -1;
    }

    if (leftGas > rightGas) {
      return 1;
    }

    return (
      (AGGREGATOR_PRIORITY[leftQuote.aggregatorName] ?? Number.MAX_SAFE_INTEGER) -
      (AGGREGATOR_PRIORITY[rightQuote.aggregatorName] ?? Number.MAX_SAFE_INTEGER)
    );
  }

  private formatFeeAmount(quote: IQuoteResponse): string {
    if (quote.feeAmountDecimals === null) {
      return '0';
    }

    return formatUnits(BigInt(quote.feeAmountBaseUnits), quote.feeAmountDecimals);
  }
}
