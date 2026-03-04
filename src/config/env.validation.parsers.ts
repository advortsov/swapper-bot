import {
  ALLOWED_NODE_ENVS,
  ENV_KEY_NODE_ENV,
  ENV_KEY_PORT,
  MAX_PORT,
  MIN_FEE_BPS,
  MIN_PORT,
  type EnvironmentSource,
  type NodeEnvironment,
} from './env.validation.constants';

export function getRequiredString(source: EnvironmentSource, key: string): string {
  const value = source[key];

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Environment variable "${key}" is required`);
  }

  return value;
}

export function getOptionalString(source: EnvironmentSource, key: string): string | undefined {
  const value = source[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error(`Environment variable "${key}" must be a string`);
  }

  return value.trim() === '' ? undefined : value.trim();
}

export function getOptionalHttpUrl(source: EnvironmentSource, key: string): string | undefined {
  const value = getOptionalString(source, key);

  if (value === undefined) {
    return undefined;
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error(`Environment variable "${key}" must be a valid URL`);
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error(`Environment variable "${key}" must use http or https protocol`);
  }

  return parsedUrl.toString();
}

export function validateNodeEnvironment(value: string): NodeEnvironment {
  if (ALLOWED_NODE_ENVS.includes(value as NodeEnvironment)) {
    return value as NodeEnvironment;
  }

  throw new Error(
    `Environment variable "${ENV_KEY_NODE_ENV}" must be one of: ${ALLOWED_NODE_ENVS.join(', ')}`,
  );
}

export function validatePort(value: string): number {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue)) {
    throw new Error(`Environment variable "${ENV_KEY_PORT}" must be a valid integer`);
  }

  if (parsedValue < MIN_PORT || parsedValue > MAX_PORT) {
    throw new Error(
      `Environment variable "${ENV_KEY_PORT}" must be between ${MIN_PORT} and ${MAX_PORT}`,
    );
  }

  return parsedValue;
}

export function getBoolean(source: EnvironmentSource, key: string, fallback: boolean): boolean {
  const value = source[key];

  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== 'string') {
    throw new Error(`Environment variable "${key}" must be "true" or "false"`);
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  throw new Error(`Environment variable "${key}" must be "true" or "false"`);
}

export function getPositiveInteger(
  source: EnvironmentSource,
  key: string,
  fallback: number,
  minValue: number,
): number {
  const value = source[key];

  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== 'string') {
    throw new Error(`Environment variable "${key}" must be a valid integer`);
  }

  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue < minValue) {
    throw new Error(
      `Environment variable "${key}" must be an integer greater than or equal to ${minValue}`,
    );
  }

  return parsedValue;
}

export function getPositiveNumber(
  source: EnvironmentSource,
  key: string,
  fallback: number,
  minValueExclusive: number,
): number {
  const value = source[key];

  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== 'string') {
    throw new Error(`Environment variable "${key}" must be a valid number`);
  }

  const parsedValue = Number.parseFloat(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= minValueExclusive) {
    throw new Error(
      `Environment variable "${key}" must be a number greater than ${minValueExclusive}`,
    );
  }

  return parsedValue;
}

export function validateOptionalBps(
  source: EnvironmentSource,
  key: string,
  maxValue: number,
): string | undefined {
  const value = getOptionalString(source, key);

  if (value === undefined) {
    return undefined;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue < MIN_FEE_BPS || parsedValue > maxValue) {
    throw new Error(
      `Environment variable "${key}" must be an integer between ${MIN_FEE_BPS} and ${maxValue}`,
    );
  }

  return value;
}

export function validateOptionalEnum(
  source: EnvironmentSource,
  key: string,
  allowedValues: readonly string[],
): string | undefined {
  const value = getOptionalString(source, key);

  if (value === undefined) {
    return undefined;
  }

  if (allowedValues.includes(value)) {
    return value;
  }

  throw new Error(`Environment variable "${key}" must be one of: ${allowedValues.join(', ')}`);
}

export function validateOptionalPositiveInteger(
  source: EnvironmentSource,
  key: string,
): string | undefined {
  const value = getOptionalString(source, key);

  if (value === undefined) {
    return undefined;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`Environment variable "${key}" must be a positive integer`);
  }

  return value;
}

export function validateOptionalCsv(
  source: EnvironmentSource,
  key: string,
  allowedValues: readonly string[],
): string | undefined {
  const value = getOptionalString(source, key);

  if (value === undefined) {
    return undefined;
  }

  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');

  if (items.length === 0) {
    throw new Error(`Environment variable "${key}" must contain at least one value`);
  }

  const invalidValue = items.find((item) => !allowedValues.includes(item));

  if (invalidValue) {
    throw new Error(`Environment variable "${key}" must contain only: ${allowedValues.join(', ')}`);
  }

  return items.join(',');
}

export function parseOptionalInteger(value: string | undefined): number {
  if (value === undefined) {
    return 0;
  }

  const parsedValue = Number.parseInt(value, 10);

  return Number.isInteger(parsedValue) ? parsedValue : 0;
}
