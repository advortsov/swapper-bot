import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import { FeePolicyConfigService } from '../../src/fees/fee-policy.config.service';
import { FeePolicyDisabledService } from '../../src/fees/fee-policy.disabled.service';
import { FeePolicyJupiterService } from '../../src/fees/fee-policy.jupiter.service';
import { FeePolicyOdosService } from '../../src/fees/fee-policy.odos.service';
import { FeePolicyParaSwapService } from '../../src/fees/fee-policy.paraswap.service';
import { FeePolicyService } from '../../src/fees/fee-policy.service';
import { FeePolicyZeroXService } from '../../src/fees/fee-policy.zerox.service';
import type { ITokenRecord } from '../../src/tokens/tokens.repository';

const ETH_TOKEN: ITokenRecord = {
  address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  symbol: 'ETH',
  decimals: 18,
  name: 'Ether',
  chain: 'ethereum',
};

const USDC_TOKEN: ITokenRecord = {
  address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  symbol: 'USDC',
  decimals: 6,
  name: 'USD Coin',
  chain: 'ethereum',
};

const SOL_TOKEN: ITokenRecord = {
  address: 'So11111111111111111111111111111111111111112',
  symbol: 'SOL',
  decimals: 9,
  name: 'Solana',
  chain: 'solana',
};

const SOLANA_USDC_TOKEN: ITokenRecord = {
  address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  symbol: 'USDC',
  decimals: 6,
  name: 'USD Coin',
  chain: 'solana',
};

function createService(values: Record<string, string>): FeePolicyService {
  const configService: Pick<ConfigService, 'get'> = {
    get: (key: string) => values[key],
  };
  const feePolicyConfigService = new FeePolicyConfigService(configService as ConfigService);
  const disabledService = new FeePolicyDisabledService();

  return new FeePolicyService(
    new FeePolicyJupiterService(feePolicyConfigService, disabledService),
    new FeePolicyOdosService(feePolicyConfigService, disabledService),
    new FeePolicyParaSwapService(feePolicyConfigService, disabledService),
    new FeePolicyZeroXService(feePolicyConfigService, disabledService),
  );
}

describe('FeePolicyService', () => {
  it('должен включать enforced 0x fee по buy token при наличии recipient и bps', () => {
    const service = createService({
      ZEROX_FEE_RECIPIENT: '0x1111111111111111111111111111111111111111',
      ZEROX_FEE_BPS: '25',
      ZEROX_FEE_TOKEN_MODE: 'buy',
    });

    const policy = service.getPolicy('0x', 'ethereum', ETH_TOKEN, USDC_TOKEN);

    expect(policy.mode).toBe('enforced');
    expect(policy.executionFee.kind).toBe('zerox');
    expect(policy.executionFee.feeAssetSymbol).toBe('USDC');
  });

  it('должен выбирать Jupiter output fee account раньше input fee account', () => {
    const service = createService({
      JUPITER_PLATFORM_FEE_BPS: '20',
      JUPITER_FEE_ACCOUNT_SOL: 'sol-fee-account',
      JUPITER_FEE_ACCOUNT_USDC: 'usdc-fee-account',
    });

    const policy = service.getPolicy('jupiter', 'solana', SOL_TOKEN, SOLANA_USDC_TOKEN);

    expect(policy.mode).toBe('enforced');
    expect(policy.executionFee.kind).toBe('jupiter');

    if (policy.executionFee.kind !== 'jupiter') {
      throw new Error('Expected Jupiter fee config');
    }

    expect(policy.executionFee.feeAssetSide).toBe('buy');
    expect(policy.executionFee.feeAccount).toBe('usdc-fee-account');
  });

  it('должен оставлять Odos в tracking_only без enforced fee', () => {
    const service = createService({
      ODOS_MONETIZATION_MODE: 'tracking_only',
    });

    const policy = service.getPolicy('odos', 'ethereum', ETH_TOKEN, USDC_TOKEN);

    expect(policy.mode).toBe('tracking_only');
    expect(policy.executionFee.kind).toBe('none');
    expect(policy.isEnabled).toBe(false);
  });

  it('должен включать enforced Odos fee при валидном referral code', () => {
    const service = createService({
      ODOS_MONETIZATION_MODE: 'enforced',
      ODOS_REFERRAL_CODE: '2147483648',
    });

    const policy = service.getPolicy('odos', 'ethereum', ETH_TOKEN, USDC_TOKEN);

    expect(policy.mode).toBe('enforced');
    expect(policy.feeType).toBe('partner fee');
    expect(policy.executionFee.kind).toBe('odos');
    expect(policy.isEnabled).toBe(true);

    if (policy.executionFee.kind !== 'odos') {
      throw new Error('Expected Odos fee config');
    }

    expect(policy.executionFee.referralCode).toBe(2147483648);
    expect(policy.executionFee.feeAssetSymbol).toBe('USDC');
  });

  it('должен выключать enforced Odos fee вне allowlist сетей', () => {
    const service = createService({
      ODOS_MONETIZATION_MODE: 'enforced',
      ODOS_REFERRAL_CODE: '2147483648',
      ODOS_MONETIZED_CHAINS: 'arbitrum,base',
    });

    const policy = service.getPolicy('odos', 'ethereum', ETH_TOKEN, USDC_TOKEN);

    expect(policy.mode).toBe('disabled');
    expect(policy.executionFee.kind).toBe('none');
  });
});
