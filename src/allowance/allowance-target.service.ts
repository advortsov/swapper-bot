import { Inject, Injectable } from '@nestjs/common';
import { formatUnits } from 'viem';

import { AllowanceReaderService } from './allowance-reader.service';
import { DUMMY_USER_ADDRESS, type IResolvedApproveContext } from './allowance.constants';
import { AGGREGATORS_TOKEN } from '../aggregators/aggregators.constants';
import type { IApproveOptionView, IApprovalTargetResponse } from './interfaces/allowance.interface';
import type { IAggregator } from '../aggregators/interfaces/aggregator.interface';
import type { ChainType } from '../chains/interfaces/chain.interface';
import { BusinessException } from '../common/exceptions/business.exception';
import { TokensService } from '../tokens/tokens.service';

@Injectable()
export class AllowanceTargetService {
  public constructor(
    @Inject(AGGREGATORS_TOKEN)
    private readonly aggregators: readonly IAggregator[],
    private readonly allowanceReaderService: AllowanceReaderService,
    private readonly tokensService: TokensService,
  ) {}

  public async resolveApprovalOptions(
    input: IResolvedApproveContext & {
      walletAddress: string | null;
    },
  ): Promise<readonly IApproveOptionView[]> {
    const quoteTargetToken = await this.resolveQuoteTargetToken(input.chain, input.tokenSymbol);
    const evmAggregators = this.aggregators.filter(
      (aggregator) =>
        aggregator.supportedChains.includes(input.chain) &&
        typeof aggregator.resolveApprovalTarget === 'function',
    );

    const settled = await Promise.allSettled(
      evmAggregators.map(async (aggregator) => {
        const target = await this.resolveApprovalTarget({
          aggregatorName: aggregator.name,
          chain: input.chain,
          sellTokenAddress: input.tokenAddress,
          buyTokenAddress: quoteTargetToken.address,
          sellAmountBaseUnits: input.amountBaseUnits,
          userAddress: input.walletAddress,
        });
        const currentAllowanceBaseUnits = input.walletAddress
          ? (
              await this.allowanceReaderService.readAllowance({
                chain: input.chain,
                tokenAddress: input.tokenAddress,
                ownerAddress: input.walletAddress,
                spenderAddress: target.spenderAddress,
              })
            ).allowanceBaseUnits
          : null;

        return {
          aggregatorName: aggregator.name,
          spenderAddress: target.spenderAddress,
          currentAllowance:
            currentAllowanceBaseUnits === null
              ? null
              : formatUnits(BigInt(currentAllowanceBaseUnits), input.tokenDecimals),
          currentAllowanceBaseUnits,
        } satisfies IApproveOptionView;
      }),
    );

    return settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
  }

  public async resolveApprovalTarget(input: {
    aggregatorName: string;
    chain: ChainType;
    sellTokenAddress: string;
    buyTokenAddress: string;
    sellAmountBaseUnits: string;
    userAddress: string | null;
  }): Promise<IApprovalTargetResponse> {
    const aggregator = this.aggregators.find(
      (candidate) => candidate.name === input.aggregatorName,
    );

    if (!aggregator?.resolveApprovalTarget) {
      throw new BusinessException(
        `Aggregator ${input.aggregatorName} does not support approve flow`,
      );
    }

    return aggregator.resolveApprovalTarget({
      chain: input.chain,
      sellTokenAddress: input.sellTokenAddress,
      buyTokenAddress: input.buyTokenAddress,
      sellAmountBaseUnits: input.sellAmountBaseUnits,
      userAddress: input.userAddress ?? DUMMY_USER_ADDRESS,
    });
  }

  private async resolveQuoteTargetToken(
    chain: ChainType,
    sellTokenSymbol: string,
  ): Promise<{
    address: string;
  }> {
    const preferredSymbol = sellTokenSymbol.toUpperCase() === 'USDC' ? 'WETH' : 'USDC';
    const token = await this.tokensService.getTokenBySymbol(preferredSymbol, chain);

    return {
      address: token.address,
    };
  }
}
