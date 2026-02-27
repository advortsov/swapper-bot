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
});
