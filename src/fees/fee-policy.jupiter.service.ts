import { Injectable } from '@nestjs/common';

import { FeePolicyConfigService } from './fee-policy.config.service';
import {
  DISPLAY_LABEL_NATIVE,
  FEE_TYPE_NATIVE,
  MAX_FEE_BPS,
  SUPPORTED_JUPITER_FEE_SYMBOLS,
  ZERO_BPS,
} from './fee-policy.constants';
import { FeePolicyDisabledService } from './fee-policy.disabled.service';
import type { ChainType } from '../chains/interfaces/chain.interface';
import type { ITokenRecord } from '../tokens/tokens.repository';
import type { IFeePolicy, IExecutionFeeConfig } from './interfaces/fee-policy.interface';

@Injectable()
export class FeePolicyJupiterService {
  public constructor(
    private readonly configService: FeePolicyConfigService,
    private readonly disabledService: FeePolicyDisabledService,
  ) {}

  public getPolicy(chain: ChainType, fromToken: ITokenRecord, toToken: ITokenRecord): IFeePolicy {
    const feeBps = this.configService.getOptionalBps('JUPITER_PLATFORM_FEE_BPS', MAX_FEE_BPS);

    if (chain !== 'solana' || feeBps === ZERO_BPS) {
      return this.disabledService.create('jupiter', chain);
    }

    const outputFeeAccount = this.getJupiterFeeAccount(toToken.symbol);

    if (outputFeeAccount) {
      return this.createPolicy({
        chain,
        feeBps,
        feeMintAddress: toToken.address,
        feeMintSymbol: toToken.symbol,
        feeAccount: outputFeeAccount,
        feeAssetSide: 'buy',
      });
    }

    const inputFeeAccount = this.getJupiterFeeAccount(fromToken.symbol);

    if (inputFeeAccount) {
      return this.createPolicy({
        chain,
        feeBps,
        feeMintAddress: fromToken.address,
        feeMintSymbol: fromToken.symbol,
        feeAccount: inputFeeAccount,
        feeAssetSide: 'sell',
      });
    }

    return this.disabledService.create('jupiter', chain);
  }

  private createPolicy(input: {
    chain: ChainType;
    feeBps: number;
    feeMintAddress: string;
    feeMintSymbol: string;
    feeAccount: string;
    feeAssetSide: 'buy' | 'sell';
  }): IFeePolicy {
    const executionFee: IExecutionFeeConfig = {
      kind: 'jupiter',
      aggregatorName: 'jupiter',
      chain: input.chain,
      mode: 'enforced',
      feeType: FEE_TYPE_NATIVE,
      feeBps: input.feeBps,
      feeAssetSide: input.feeAssetSide,
      feeAssetAddress: input.feeMintAddress,
      feeAssetSymbol: input.feeMintSymbol,
      feeAppliedAtQuote: true,
      feeEnforcedOnExecution: true,
      feeAccount: input.feeAccount,
      feeMintAddress: input.feeMintAddress,
    };

    return {
      aggregatorName: 'jupiter',
      chain: input.chain,
      mode: 'enforced',
      feeType: FEE_TYPE_NATIVE,
      feeBps: input.feeBps,
      displayLabel: DISPLAY_LABEL_NATIVE,
      isEnabled: true,
      executionFee,
    };
  }

  private getJupiterFeeAccount(symbol: string): string | null {
    if (
      !SUPPORTED_JUPITER_FEE_SYMBOLS.includes(
        symbol.toUpperCase() as (typeof SUPPORTED_JUPITER_FEE_SYMBOLS)[number],
      )
    ) {
      return null;
    }

    return (
      this.configService.getOptionalTrimmed(`JUPITER_FEE_ACCOUNT_${symbol.toUpperCase()}`) ?? null
    );
  }
}
