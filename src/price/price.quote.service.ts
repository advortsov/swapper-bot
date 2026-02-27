import { Inject, Injectable } from '@nestjs/common';
import { formatUnits, parseUnits } from 'viem';

import { AGGREGATORS_TOKEN } from '../aggregators/aggregators.constants';
import type { IAggregator, IQuoteResponse } from '../aggregators/interfaces/aggregator.interface';
import { EthereumChain } from '../chains/ethereum/ethereum.chain';
import { BusinessException } from '../common/exceptions/business.exception';
import { TokensService } from '../tokens/tokens.service';
import type { IPriceRequest, IPriceResponse } from './interfaces/price.interface';
import type { ITokenRecord } from '../tokens/tokens.repository';

const CHAIN_NAME = 'ethereum';

export interface IPreparedPriceInput {
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
    private readonly ethereumChain: EthereumChain,
  ) {}

  public async prepare(request: IPriceRequest): Promise<IPreparedPriceInput> {
    const normalizedAmount = this.normalizeAmount(request.amount);
    const fromToken = await this.tokensService.getTokenBySymbol(request.fromSymbol);
    const toToken = await this.tokensService.getTokenBySymbol(request.toSymbol);

    this.ensureSupportedPair(fromToken.address, toToken.address);

    return {
      normalizedAmount,
      cacheKey: this.buildCacheKey(normalizedAmount, fromToken.symbol, toToken.symbol),
      fromToken,
      toToken,
      sellAmountBaseUnits: parseUnits(normalizedAmount, fromToken.decimals).toString(),
    };
  }

  public async fetchBestQuote(input: IPreparedPriceInput): Promise<IQuoteResponse> {
    const chainAggregators = this.aggregators.filter((aggregator) =>
      aggregator.supportedChains.includes(CHAIN_NAME),
    );

    if (chainAggregators.length === 0) {
      throw new BusinessException(`No aggregators configured for chain ${CHAIN_NAME}`);
    }

    const quotes = await Promise.all(
      chainAggregators.map(async (aggregator) =>
        aggregator.getQuote({
          chain: CHAIN_NAME,
          sellTokenAddress: input.fromToken.address,
          buyTokenAddress: input.toToken.address,
          sellAmountBaseUnits: input.sellAmountBaseUnits,
        }),
      ),
    );

    return quotes.reduce((bestQuote, currentQuote) => {
      if (BigInt(currentQuote.toAmountBaseUnits) > BigInt(bestQuote.toAmountBaseUnits)) {
        return currentQuote;
      }

      return bestQuote;
    });
  }

  public buildResponse(input: IPreparedPriceInput, quote: IQuoteResponse): IPriceResponse {
    return {
      chain: CHAIN_NAME,
      aggregator: quote.aggregatorName,
      fromSymbol: input.fromToken.symbol,
      toSymbol: input.toToken.symbol,
      fromAmount: input.normalizedAmount,
      toAmount: formatUnits(BigInt(quote.toAmountBaseUnits), input.toToken.decimals),
      estimatedGasUsd: quote.estimatedGasUsd,
    };
  }

  private normalizeAmount(amount: string): string {
    const parsedAmount = Number.parseFloat(amount);

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new BusinessException('Amount must be a positive number');
    }

    return amount.trim();
  }

  private buildCacheKey(amount: string, fromSymbol: string, toSymbol: string): string {
    return `${CHAIN_NAME}:${fromSymbol}:${toSymbol}:${amount}`;
  }

  private ensureSupportedPair(fromAddress: string, toAddress: string): void {
    if (!this.ethereumChain.validateAddress(fromAddress)) {
      throw new BusinessException(`Invalid from token address: ${fromAddress}`);
    }

    if (!this.ethereumChain.validateAddress(toAddress)) {
      throw new BusinessException(`Invalid to token address: ${toAddress}`);
    }
  }
}
