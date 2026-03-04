import { Injectable } from '@nestjs/common';
import { parseUnits } from 'viem';

import {
  EVM_CHAINS,
  EVM_NATIVE_TOKEN_ADDRESS,
  type IEvmChainType,
  type IResolvedApproveContext,
} from './allowance.constants';
import type { IApproveCommandRequest } from './interfaces/allowance.interface';
import type { ChainType } from '../chains/interfaces/chain.interface';
import { BusinessException } from '../common/exceptions/business.exception';
import { TokenAddressResolverService } from '../token-resolution/token-address-resolver.service';

@Injectable()
export class AllowanceContextService {
  public constructor(private readonly tokenAddressResolverService: TokenAddressResolverService) {}

  public async resolveApproveContext(
    request: IApproveCommandRequest,
  ): Promise<IResolvedApproveContext> {
    if (!this.isEvmChain(request.chain)) {
      throw new BusinessException('Approve поддержан только для EVM-сетей');
    }

    const token = await this.tokenAddressResolverService.resolveTokenInput(
      request.tokenInput,
      request.chain,
      request.explicitChain,
    );

    if (this.isNativeTokenAddress(token.address)) {
      throw new BusinessException(
        `Токен ${token.symbol} нативный и не требует approve в сети ${request.chain}`,
      );
    }

    return {
      chain: request.chain,
      tokenSymbol: token.symbol,
      tokenAddress: token.address,
      tokenDecimals: token.decimals,
      amount: request.amount,
      amountBaseUnits: parseUnits(request.amount, token.decimals).toString(),
    };
  }

  public isEvmChain(chain: ChainType): chain is IEvmChainType {
    return EVM_CHAINS.includes(chain as IEvmChainType);
  }

  public isNativeTokenAddress(address: string): boolean {
    return address.trim().toLowerCase() === EVM_NATIVE_TOKEN_ADDRESS;
  }
}
