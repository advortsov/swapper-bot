import { Inject, Injectable } from '@nestjs/common';

import { FeePolicyDisabledService } from './fee-policy.disabled.service';
import { FeePolicyJupiterService } from './fee-policy.jupiter.service';
import { FeePolicyOdosService } from './fee-policy.odos.service';
import { FeePolicyParaSwapService } from './fee-policy.paraswap.service';
import { FeePolicyZeroXService } from './fee-policy.zerox.service';
import type { IFeePolicy } from './interfaces/fee-policy.interface';
import type { ChainType } from '../chains/interfaces/chain.interface';
import type { ITokenRecord } from '../tokens/tokens.repository';

@Injectable()
export class FeePolicyService {
  @Inject()
  private readonly disabledService!: FeePolicyDisabledService;

  public constructor(
    private readonly jupiterService: FeePolicyJupiterService,
    private readonly odosService: FeePolicyOdosService,
    private readonly paraSwapService: FeePolicyParaSwapService,
    private readonly zeroXService: FeePolicyZeroXService,
  ) {}

  public getPolicy(
    aggregatorName: string,
    chain: ChainType,
    fromToken: ITokenRecord,
    toToken: ITokenRecord,
  ): IFeePolicy {
    switch (aggregatorName) {
      case '0x':
        return this.zeroXService.getPolicy(chain, fromToken, toToken);
      case 'paraswap':
        return this.paraSwapService.getPolicy(chain, toToken);
      case 'jupiter':
        return this.jupiterService.getPolicy(chain, fromToken, toToken);
      case 'odos':
        return this.odosService.getPolicy(chain, toToken);
      default:
        return this.disabledService.create(aggregatorName, chain);
    }
  }
}
