import { Injectable } from '@nestjs/common';

import { FeePolicyConfigService } from './fee-policy.config.service';
import {
  DISPLAY_LABEL_PARTNER,
  FEE_TYPE_PARTNER,
  MAX_PARASWAP_FEE_BPS,
  ZERO_BPS,
} from './fee-policy.constants';
import { FeePolicyDisabledService } from './fee-policy.disabled.service';
import type { ChainType } from '../chains/interfaces/chain.interface';
import type { ITokenRecord } from '../tokens/tokens.repository';
import type { IFeePolicy, IExecutionFeeConfig } from './interfaces/fee-policy.interface';

@Injectable()
export class FeePolicyParaSwapService {
  public constructor(
    private readonly configService: FeePolicyConfigService,
    private readonly disabledService: FeePolicyDisabledService,
  ) {}

  public getPolicy(chain: ChainType, toToken: ITokenRecord): IFeePolicy {
    const partnerAddress = this.configService.getOptionalTrimmed('PARASWAP_PARTNER_ADDRESS');
    const partnerName = this.configService.getOptionalTrimmed('PARASWAP_PARTNER_NAME');
    const feeBps = this.configService.getOptionalBps('PARASWAP_FEE_BPS', MAX_PARASWAP_FEE_BPS);

    if (chain === 'solana' || !partnerAddress || feeBps === ZERO_BPS) {
      return this.disabledService.create('paraswap', chain);
    }

    const executionFee: IExecutionFeeConfig = {
      kind: 'paraswap',
      aggregatorName: 'paraswap',
      chain,
      mode: 'enforced',
      feeType: FEE_TYPE_PARTNER,
      feeBps,
      feeAssetSide: 'buy',
      feeAssetAddress: toToken.address,
      feeAssetSymbol: toToken.symbol,
      feeAppliedAtQuote: true,
      feeEnforcedOnExecution: true,
      partnerAddress,
      partnerName,
    };

    return {
      aggregatorName: 'paraswap',
      chain,
      mode: 'enforced',
      feeType: FEE_TYPE_PARTNER,
      feeBps,
      displayLabel: DISPLAY_LABEL_PARTNER,
      isEnabled: true,
      executionFee,
    };
  }
}
