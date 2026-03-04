import { Injectable } from '@nestjs/common';

import { DISPLAY_LABEL_NONE, FEE_TYPE_NONE, ZERO_BPS } from './fee-policy.constants';
import type { IFeePolicy, IExecutionFeeConfig } from './interfaces/fee-policy.interface';
import type { ChainType } from '../chains/interfaces/chain.interface';

@Injectable()
export class FeePolicyDisabledService {
  public create(aggregatorName: string, chain: ChainType): IFeePolicy {
    const executionFee: IExecutionFeeConfig = {
      kind: 'none',
      aggregatorName,
      chain,
      mode: 'disabled',
      feeType: FEE_TYPE_NONE,
      feeBps: ZERO_BPS,
      feeAssetSide: 'none',
      feeAssetAddress: null,
      feeAssetSymbol: null,
      feeAppliedAtQuote: false,
      feeEnforcedOnExecution: false,
    };

    return {
      aggregatorName,
      chain,
      mode: 'disabled',
      feeType: FEE_TYPE_NONE,
      feeBps: ZERO_BPS,
      displayLabel: DISPLAY_LABEL_NONE,
      isEnabled: false,
      executionFee,
    };
  }

  public createTrackingOnly(aggregatorName: string, chain: ChainType): IFeePolicy {
    const executionFee: IExecutionFeeConfig = {
      kind: 'none',
      aggregatorName,
      chain,
      mode: 'tracking_only',
      feeType: FEE_TYPE_NONE,
      feeBps: ZERO_BPS,
      feeAssetSide: 'none',
      feeAssetAddress: null,
      feeAssetSymbol: null,
      feeAppliedAtQuote: false,
      feeEnforcedOnExecution: false,
    };

    return {
      aggregatorName,
      chain,
      mode: 'tracking_only',
      feeType: FEE_TYPE_NONE,
      feeBps: ZERO_BPS,
      displayLabel: DISPLAY_LABEL_NONE,
      isEnabled: false,
      executionFee,
    };
  }
}
