import { Inject, Injectable } from '@nestjs/common';
import { parseUnits } from 'viem';

import { CHAINS_TOKEN, type IChainsCollection } from '../chains/chains.constants';
import type { ChainType, IChain } from '../chains/interfaces/chain.interface';
import { BusinessException } from '../common/exceptions/business.exception';
import { TokenAddressResolverService } from '../token-resolution/token-address-resolver.service';
import type { IPriceRequest } from './interfaces/price.interface';
import type { IPreparedPriceInput } from './price.quote.types';

@Injectable()
export class PriceTokenResolutionService {
  public constructor(
    @Inject(CHAINS_TOKEN)
    private readonly chains: IChainsCollection,
    private readonly tokenAddressResolverService: TokenAddressResolverService,
  ) {}

  public async prepare(request: IPriceRequest): Promise<IPreparedPriceInput> {
    const normalizedAmount = this.normalizeAmount(request.amount);
    const chain = this.resolveChain(request.chain);
    const fromToken = await this.tokenAddressResolverService.resolveTokenInput(
      request.fromTokenInput,
      request.chain,
      request.explicitChain,
    );
    const toToken = await this.tokenAddressResolverService.resolveTokenInput(
      request.toTokenInput,
      request.chain,
      request.explicitChain,
    );

    this.ensureSupportedPair(chain, fromToken.address, toToken.address);

    return {
      chain: request.chain,
      normalizedAmount,
      cacheKey: this.buildCacheKey(
        request.chain,
        normalizedAmount,
        fromToken.address,
        toToken.address,
      ),
      fromToken,
      toToken,
      sellAmountBaseUnits: parseUnits(normalizedAmount, fromToken.decimals).toString(),
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
