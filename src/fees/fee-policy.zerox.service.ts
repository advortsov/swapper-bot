import { Injectable } from '@nestjs/common';

import { FeePolicyConfigService } from './fee-policy.config.service';
import {
  DEFAULT_ZEROX_TOKEN_POLICY,
  DISPLAY_LABEL_NATIVE,
  FEE_TYPE_NATIVE,
  MAX_FEE_BPS,
  ZERO_BPS,
} from './fee-policy.constants';
import { FeePolicyDisabledService } from './fee-policy.disabled.service';
import type { ChainType } from '../chains/interfaces/chain.interface';
import type { ITokenRecord } from '../tokens/tokens.repository';
import type { IFeePolicy, IExecutionFeeConfig } from './interfaces/fee-policy.interface';

@Injectable()
export class FeePolicyZeroXService {
  public constructor(
    private readonly configService: FeePolicyConfigService,
    private readonly disabledService: FeePolicyDisabledService,
  ) {}

  public getPolicy(chain: ChainType, fromToken: ITokenRecord, toToken: ITokenRecord): IFeePolicy {
    const feeRecipient = this.configService.getOptionalTrimmed('ZEROX_FEE_RECIPIENT');
    const feeBps = this.configService.getOptionalBps('ZEROX_FEE_BPS', MAX_FEE_BPS);
    const tokenPolicy =
      this.configService.getOptionalTrimmed('ZEROX_FEE_TOKEN_MODE') ?? DEFAULT_ZEROX_TOKEN_POLICY;

    if (chain === 'solana' || !feeRecipient || feeBps === ZERO_BPS) {
      return this.disabledService.create('0x', chain);
    }

    const useSellToken = tokenPolicy === 'sell';
    const feeToken = useSellToken ? fromToken : toToken;
    const feeAssetSide = useSellToken ? 'sell' : 'buy';
    const executionFee: IExecutionFeeConfig = {
      kind: 'zerox',
      aggregatorName: '0x',
      chain,
      mode: 'enforced',
      feeType: FEE_TYPE_NATIVE,
      feeBps,
      feeAssetSide,
      feeAssetAddress: feeToken.address,
      feeAssetSymbol: feeToken.symbol,
      feeAppliedAtQuote: true,
      feeEnforcedOnExecution: true,
      feeRecipient,
      feeTokenAddress: feeToken.address,
    };

    return {
      aggregatorName: '0x',
      chain,
      mode: 'enforced',
      feeType: FEE_TYPE_NATIVE,
      feeBps,
      displayLabel: DISPLAY_LABEL_NATIVE,
      isEnabled: true,
      executionFee,
    };
  }
}
