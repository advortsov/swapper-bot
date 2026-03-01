import { describe, expect, it } from 'vitest';

import { validateEnvironment } from '../../src/config/env.validation';

const validEnvironment = {
  NODE_ENV: 'development',
  PORT: '3000',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/dex_bot',
  TELEGRAM_ENABLED: 'false',
};

describe('validateEnvironment', () => {
  it('должен возвращать корректно преобразованную конфигурацию', () => {
    const result = validateEnvironment(validEnvironment);

    expect(result).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL: validEnvironment.DATABASE_URL,
    });
  });

  it('должен выбрасывать ошибку при невалидном PORT', () => {
    const resultWithInvalidPort = {
      ...validEnvironment,
      PORT: 'abc',
    };

    expect(() => validateEnvironment(resultWithInvalidPort)).toThrowError(
      'Environment variable "PORT" must be a valid integer',
    );
  });

  it('должен выбрасывать ошибку при отсутствии DATABASE_URL', () => {
    const resultWithoutDatabaseUrl: Record<string, unknown> = {
      ...validEnvironment,
    };
    delete resultWithoutDatabaseUrl['DATABASE_URL'];

    expect(() => validateEnvironment(resultWithoutDatabaseUrl)).toThrowError(
      'Environment variable "DATABASE_URL" is required',
    );
  });

  it('должен требовать TELEGRAM_BOT_TOKEN при включенном TELEGRAM_ENABLED', () => {
    const resultWithEnabledTelegram = {
      ...validEnvironment,
      TELEGRAM_ENABLED: 'true',
    };

    expect(() => validateEnvironment(resultWithEnabledTelegram)).toThrowError(
      'Environment variable "TELEGRAM_BOT_TOKEN" is required',
    );
  });

  it('должен выбрасывать ошибку при невалидном APP_PUBLIC_URL', () => {
    const environmentWithInvalidAppPublicUrl = {
      ...validEnvironment,
      APP_PUBLIC_URL: 'not-a-url',
    };

    expect(() => validateEnvironment(environmentWithInvalidAppPublicUrl)).toThrowError(
      'Environment variable "APP_PUBLIC_URL" must be a valid URL',
    );
  });

  it('должен выбрасывать ошибку при невалидном ZEROX_FEE_BPS', () => {
    const environmentWithInvalidFeeBps = {
      ...validEnvironment,
      ZEROX_FEE_BPS: '10001',
    };

    expect(() => validateEnvironment(environmentWithInvalidFeeBps)).toThrowError(
      'Environment variable "ZEROX_FEE_BPS" must be an integer between 0 and 10000',
    );
  });

  it('должен требовать ZEROX_FEE_RECIPIENT при включенной комиссии 0x', () => {
    const environmentWithMissingZeroXRecipient = {
      ...validEnvironment,
      ZEROX_FEE_BPS: '25',
    };

    expect(() => validateEnvironment(environmentWithMissingZeroXRecipient)).toThrowError(
      'Environment variable "ZEROX_FEE_RECIPIENT" is required',
    );
  });

  it('должен требовать PARASWAP_PARTNER_ADDRESS при включенной комиссии ParaSwap', () => {
    const environmentWithMissingParaSwapPartner = {
      ...validEnvironment,
      PARASWAP_FEE_BPS: '15',
    };

    expect(() => validateEnvironment(environmentWithMissingParaSwapPartner)).toThrowError(
      'Environment variable "PARASWAP_PARTNER_ADDRESS" is required',
    );
  });

  it('должен требовать хотя бы один JUPITER_FEE_ACCOUNT при включенной комиссии Jupiter', () => {
    const environmentWithMissingJupiterFeeAccounts = {
      ...validEnvironment,
      JUPITER_PLATFORM_FEE_BPS: '20',
    };

    expect(() => validateEnvironment(environmentWithMissingJupiterFeeAccounts)).toThrowError(
      'At least one JUPITER_FEE_ACCOUNT_<SYMBOL> must be configured when JUPITER_PLATFORM_FEE_BPS is greater than 0',
    );
  });

  it('должен запрещать ODOS_MONETIZATION_MODE=enforced на текущем этапе', () => {
    const environmentWithUnsupportedOdosMode = {
      ...validEnvironment,
      ODOS_MONETIZATION_MODE: 'enforced',
    };

    expect(() => validateEnvironment(environmentWithUnsupportedOdosMode)).toThrowError(
      'Environment variable "ODOS_MONETIZATION_MODE" cannot be "enforced" in the current launch stage',
    );
  });

  it('должен принимать ParaSwap только с версией API 6.2', () => {
    const environmentWithUnsupportedParaswapVersion = {
      ...validEnvironment,
      PARASWAP_API_VERSION: '6.1',
    };

    expect(() => validateEnvironment(environmentWithUnsupportedParaswapVersion)).toThrowError(
      'Environment variable "PARASWAP_API_VERSION" must be "6.2"',
    );
  });
});
