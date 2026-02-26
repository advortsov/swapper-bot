import { describe, expect, it } from 'vitest';

import { validateEnvironment } from '../../src/config/env.validation';

const validEnvironment = {
  NODE_ENV: 'development',
  PORT: '3000',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/dex_bot',
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
});
