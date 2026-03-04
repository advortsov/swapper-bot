import { Injectable } from '@nestjs/common';

import { FeePolicyConfigService } from './fee-policy.config.service';
import {
  DEFAULT_ODOS_MODE,
  DISPLAY_LABEL_PARTNER,
  FEE_TYPE_PARTNER,
  ODOS_MONETIZABLE_CHAINS,
  ZERO_BPS,
} from './fee-policy.constants';
import { FeePolicyDisabledService } from './fee-policy.disabled.service';
import type { ChainType } from '../chains/interfaces/chain.interface';
import type { ITokenRecord } from '../tokens/tokens.repository';
import type { IFeePolicy, IExecutionFeeConfig } from './interfaces/fee-policy.interface';

@Injectable()
export class FeePolicyOdosService {
  public constructor(
    private readonly configService: FeePolicyConfigService,
    private readonly disabledService: FeePolicyDisabledService,
  ) {}

  public getPolicy(chain: ChainType, toToken: ITokenRecord): IFeePolicy {
    const configuredMode =
      this.configService.getOptionalTrimmed('ODOS_MONETIZATION_MODE') ?? DEFAULT_ODOS_MODE;

    if (configuredMode === 'enforced') {
      const referralCode = this.configService.getOptionalPositiveInteger('ODOS_REFERRAL_CODE');

      if (
        chain === 'solana' ||
        referralCode === null ||
        !this.isOdosMonetizedChain(chain) ||
        !this.isOdosChainEnabled(chain)
      ) {
        return this.disabledService.create('odos', chain);
      }

      const executionFee: IExecutionFeeConfig = {
        kind: 'odos',
        aggregatorName: 'odos',
        chain,
        mode: 'enforced',
        feeType: FEE_TYPE_PARTNER,
        feeBps: ZERO_BPS,
        feeAssetSide: 'buy',
        feeAssetAddress: toToken.address,
        feeAssetSymbol: toToken.symbol,
        feeAppliedAtQuote: true,
        feeEnforcedOnExecution: true,
        referralCode,
      };

      return {
        aggregatorName: 'odos',
        chain,
        mode: 'enforced',
        feeType: FEE_TYPE_PARTNER,
        feeBps: ZERO_BPS,
        displayLabel: DISPLAY_LABEL_PARTNER,
        isEnabled: true,
        executionFee,
      };
    }

    if (configuredMode === 'tracking_only') {
      return this.disabledService.createTrackingOnly('odos', chain);
    }

    return this.disabledService.create('odos', chain);
  }

  private isOdosMonetizedChain(chain: ChainType): boolean {
    return ODOS_MONETIZABLE_CHAINS.includes(chain as (typeof ODOS_MONETIZABLE_CHAINS)[number]);
  }

  private isOdosChainEnabled(chain: ChainType): boolean {
    const rawChains = this.configService.getOptionalTrimmed('ODOS_MONETIZED_CHAINS');

    if (rawChains === null) {
      return true;
    }

    const enabledChains = rawChains
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item !== '');

    if (enabledChains.length === 0) {
      return true;
    }

    return enabledChains.includes(chain);
  }
}
