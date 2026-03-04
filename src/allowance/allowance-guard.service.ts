import { Injectable } from '@nestjs/common';
import { formatUnits } from 'viem';

import { AllowanceActionService } from './allowance-action.service';
import { AllowanceContextService } from './allowance-context.service';
import { AllowanceReaderService } from './allowance-reader.service';
import { AllowanceTargetService } from './allowance-target.service';
import { InsufficientAllowanceException } from './insufficient-allowance.exception';
import type { ChainType } from '../chains/interfaces/chain.interface';

@Injectable()
export class AllowanceGuardService {
  public constructor(
    private readonly allowanceActionService: AllowanceActionService,
    private readonly allowanceContextService: AllowanceContextService,
    private readonly allowanceReaderService: AllowanceReaderService,
    private readonly allowanceTargetService: AllowanceTargetService,
  ) {}

  public async ensureSufficientAllowance(input: {
    userId: string;
    chain: ChainType;
    aggregatorName: string;
    walletAddress: string;
    tokenSymbol: string;
    tokenAddress: string;
    tokenDecimals: number;
    buyTokenAddress: string;
    amount: string;
    amountBaseUnits: string;
  }): Promise<void> {
    if (
      !this.allowanceContextService.isEvmChain(input.chain) ||
      this.allowanceContextService.isNativeTokenAddress(input.tokenAddress)
    ) {
      return;
    }

    const approvalTarget = await this.allowanceTargetService.resolveApprovalTarget({
      aggregatorName: input.aggregatorName,
      chain: input.chain,
      sellTokenAddress: input.tokenAddress,
      buyTokenAddress: input.buyTokenAddress,
      sellAmountBaseUnits: input.amountBaseUnits,
      userAddress: input.walletAddress,
    });
    const allowance = await this.allowanceReaderService.readAllowance({
      chain: input.chain,
      tokenAddress: input.tokenAddress,
      ownerAddress: input.walletAddress,
      spenderAddress: approvalTarget.spenderAddress,
    });

    if (BigInt(allowance.allowanceBaseUnits) >= BigInt(input.amountBaseUnits)) {
      return;
    }

    const currentAllowance = formatUnits(BigInt(allowance.allowanceBaseUnits), input.tokenDecimals);
    const actionToken = this.allowanceActionService.createInsufficientAllowanceAction({
      userId: input.userId,
      chain: input.chain,
      tokenSymbol: input.tokenSymbol,
      tokenAddress: input.tokenAddress,
      tokenDecimals: input.tokenDecimals,
      amount: input.amount,
      amountBaseUnits: input.amountBaseUnits,
      walletAddress: input.walletAddress,
      option: {
        aggregatorName: input.aggregatorName,
        spenderAddress: approvalTarget.spenderAddress,
        currentAllowance,
        currentAllowanceBaseUnits: allowance.allowanceBaseUnits,
      },
    });

    throw new InsufficientAllowanceException({
      chain: input.chain,
      tokenSymbol: input.tokenSymbol,
      tokenAddress: input.tokenAddress,
      tokenDecimals: input.tokenDecimals,
      amount: input.amount,
      amountBaseUnits: input.amountBaseUnits,
      currentAllowance,
      currentAllowanceBaseUnits: allowance.allowanceBaseUnits,
      spenderAddress: approvalTarget.spenderAddress,
      aggregatorName: input.aggregatorName,
      actionToken,
    });
  }
}
