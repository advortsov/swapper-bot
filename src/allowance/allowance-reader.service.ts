import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicClient, http } from 'viem';

import {
  ERC20_ALLOWANCE_ABI,
  EVM_CHAINS,
  EVM_CHAIN_CONFIG,
  type IAllowanceClient,
  type IEvmChainType,
} from './allowance.constants';
import type {
  IAllowanceCheckRequest,
  IAllowanceCheckResult,
} from './interfaces/allowance.interface';
import type { ChainType } from '../chains/interfaces/chain.interface';
import { BusinessException } from '../common/exceptions/business.exception';

@Injectable()
export class AllowanceReaderService {
  public constructor(private readonly configService: ConfigService) {}

  public async readAllowance(request: IAllowanceCheckRequest): Promise<IAllowanceCheckResult> {
    const client = this.getClient(request.chain);
    const allowance = await client.readContract({
      address: request.tokenAddress as `0x${string}`,
      abi: ERC20_ALLOWANCE_ABI,
      functionName: 'allowance',
      args: [request.ownerAddress as `0x${string}`, request.spenderAddress as `0x${string}`],
    });

    return {
      allowanceBaseUnits: allowance.toString(),
    };
  }

  private getClient(chain: ChainType): IAllowanceClient {
    if (!EVM_CHAINS.includes(chain as IEvmChainType)) {
      throw new BusinessException('Approve поддержан только для EVM-сетей');
    }

    const config = EVM_CHAIN_CONFIG[chain as IEvmChainType];

    return createPublicClient({
      chain: config.chain,
      transport: http(this.configService.get<string>(config.envKey)),
    });
  }
}
