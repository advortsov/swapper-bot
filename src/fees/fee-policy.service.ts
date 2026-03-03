import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { ChainType } from '../chains/interfaces/chain.interface';
import type { ITokenRecord } from '../tokens/tokens.repository';
import type { IFeePolicy, IExecutionFeeConfig } from './interfaces/fee-policy.interface';

const ZERO_BPS = 0;
const MAX_FEE_BPS = 10_000;
const MAX_PARASWAP_FEE_BPS = 200;
const DEFAULT_ODOS_MODE = 'disabled';
const DEFAULT_ZEROX_TOKEN_POLICY = 'auto';
const FEE_TYPE_NATIVE = 'native fee';
const FEE_TYPE_PARTNER = 'partner fee';
const FEE_TYPE_NONE = 'no fee';
const DISPLAY_LABEL_NATIVE = 'native fee';
const DISPLAY_LABEL_PARTNER = 'partner fee';
const DISPLAY_LABEL_NONE = 'no fee';
const SUPPORTED_JUPITER_FEE_SYMBOLS = ['SOL', 'USDC', 'USDT', 'JUP', 'BONK'] as const;
const ODOS_MONETIZABLE_CHAINS = ['ethereum', 'arbitrum', 'base', 'optimism'] as const;

type IJupiterFeeSymbol = (typeof SUPPORTED_JUPITER_FEE_SYMBOLS)[number];
type IOdosChain = (typeof ODOS_MONETIZABLE_CHAINS)[number];

@Injectable()
export class FeePolicyService {
  public constructor(private readonly configService: ConfigService) {}

  public getPolicy(
    aggregatorName: string,
    chain: ChainType,
    fromToken: ITokenRecord,
    toToken: ITokenRecord,
  ): IFeePolicy {
    switch (aggregatorName) {
      case '0x':
        return this.getZeroXPolicy(chain, fromToken, toToken);
      case 'paraswap':
        return this.getParaSwapPolicy(chain, toToken);
      case 'jupiter':
        return this.getJupiterPolicy(chain, fromToken, toToken);
      case 'odos':
        return this.getOdosPolicy(chain, toToken);
      default:
        return this.getDisabledPolicy(aggregatorName, chain);
    }
  }

  private getZeroXPolicy(
    chain: ChainType,
    fromToken: ITokenRecord,
    toToken: ITokenRecord,
  ): IFeePolicy {
    const feeRecipient = this.getOptionalTrimmed('ZEROX_FEE_RECIPIENT');
    const feeBps = this.getOptionalBps('ZEROX_FEE_BPS', MAX_FEE_BPS);
    const tokenPolicy =
      this.getOptionalTrimmed('ZEROX_FEE_TOKEN_MODE') ?? DEFAULT_ZEROX_TOKEN_POLICY;

    if (chain === 'solana' || !feeRecipient || feeBps === ZERO_BPS) {
      return this.getDisabledPolicy('0x', chain);
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

  private getParaSwapPolicy(chain: ChainType, toToken: ITokenRecord): IFeePolicy {
    const partnerAddress = this.getOptionalTrimmed('PARASWAP_PARTNER_ADDRESS');
    const partnerName = this.getOptionalTrimmed('PARASWAP_PARTNER_NAME');
    const feeBps = this.getOptionalBps('PARASWAP_FEE_BPS', MAX_PARASWAP_FEE_BPS);

    if (chain === 'solana' || !partnerAddress || feeBps === ZERO_BPS) {
      return this.getDisabledPolicy('paraswap', chain);
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

  private getJupiterPolicy(
    chain: ChainType,
    fromToken: ITokenRecord,
    toToken: ITokenRecord,
  ): IFeePolicy {
    const feeBps = this.getOptionalBps('JUPITER_PLATFORM_FEE_BPS', MAX_FEE_BPS);

    if (chain !== 'solana' || feeBps === ZERO_BPS) {
      return this.getDisabledPolicy('jupiter', chain);
    }

    const outputFeeAccount = this.getJupiterFeeAccount(toToken.symbol);

    if (outputFeeAccount) {
      return this.createJupiterPolicy({
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
      return this.createJupiterPolicy({
        chain,
        feeBps,
        feeMintAddress: fromToken.address,
        feeMintSymbol: fromToken.symbol,
        feeAccount: inputFeeAccount,
        feeAssetSide: 'sell',
      });
    }

    return this.getDisabledPolicy('jupiter', chain);
  }

  private getOdosPolicy(chain: ChainType, toToken: ITokenRecord): IFeePolicy {
    const configuredMode = this.getOptionalTrimmed('ODOS_MONETIZATION_MODE') ?? DEFAULT_ODOS_MODE;

    if (configuredMode === 'enforced') {
      const referralCode = this.getOptionalPositiveInteger('ODOS_REFERRAL_CODE');

      if (
        chain === 'solana' ||
        referralCode === null ||
        !this.isOdosMonetizedChain(chain) ||
        !this.isOdosChainEnabled(chain)
      ) {
        return this.getDisabledPolicy('odos', chain);
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
      const executionFee: IExecutionFeeConfig = {
        kind: 'none',
        aggregatorName: 'odos',
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
        aggregatorName: 'odos',
        chain,
        mode: 'tracking_only',
        feeType: FEE_TYPE_NONE,
        feeBps: ZERO_BPS,
        displayLabel: DISPLAY_LABEL_NONE,
        isEnabled: false,
        executionFee,
      };
    }

    return this.getDisabledPolicy('odos', chain);
  }

  private createJupiterPolicy(input: {
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

  private getDisabledPolicy(aggregatorName: string, chain: ChainType): IFeePolicy {
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

  private getJupiterFeeAccount(symbol: string): string | null {
    if (!this.isSupportedJupiterFeeSymbol(symbol)) {
      return null;
    }

    return this.getOptionalTrimmed(`JUPITER_FEE_ACCOUNT_${symbol.toUpperCase()}`) ?? null;
  }

  private isSupportedJupiterFeeSymbol(symbol: string): symbol is IJupiterFeeSymbol {
    return SUPPORTED_JUPITER_FEE_SYMBOLS.includes(symbol.toUpperCase() as IJupiterFeeSymbol);
  }

  private isOdosMonetizedChain(chain: ChainType): chain is IOdosChain {
    return ODOS_MONETIZABLE_CHAINS.includes(chain as IOdosChain);
  }

  private isOdosChainEnabled(chain: IOdosChain): boolean {
    const rawChains = this.getOptionalTrimmed('ODOS_MONETIZED_CHAINS');

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

  private getOptionalTrimmed(key: string): string | null {
    const value = this.configService.get<string>(key);

    if (!value || value.trim() === '') {
      return null;
    }

    return value.trim();
  }

  private getOptionalPositiveInteger(key: string): number | null {
    const value = this.getOptionalTrimmed(key);

    if (value === null) {
      return null;
    }

    const parsed = Number.parseInt(value, 10);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      return null;
    }

    return parsed;
  }

  private getOptionalBps(key: string, maxValue: number): number {
    const value = this.getOptionalTrimmed(key);

    if (!value) {
      return ZERO_BPS;
    }

    const parsed = Number.parseInt(value, 10);

    if (!Number.isInteger(parsed) || parsed < ZERO_BPS || parsed > maxValue) {
      return ZERO_BPS;
    }

    return parsed;
  }
}
