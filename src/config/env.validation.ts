const ENV_KEY_NODE_ENV = 'NODE_ENV';
const ENV_KEY_PORT = 'PORT';
const ENV_KEY_DATABASE_URL = 'DATABASE_URL';
const ENV_KEY_TELEGRAM_ENABLED = 'TELEGRAM_ENABLED';
const ENV_KEY_TELEGRAM_BOT_TOKEN = 'TELEGRAM_BOT_TOKEN';
const ENV_KEY_METRICS_ENABLED = 'METRICS_ENABLED';
const ENV_KEY_CACHE_TTL_PRICE = 'CACHE_TTL_PRICE';
const ENV_KEY_WC_PROJECT_ID = 'WC_PROJECT_ID';
const ENV_KEY_APP_PUBLIC_URL = 'APP_PUBLIC_URL';
const ENV_KEY_SWAP_SLIPPAGE = 'SWAP_SLIPPAGE';
const ENV_KEY_SWAP_TIMEOUT_SECONDS = 'SWAP_TIMEOUT_SECONDS';
const ENV_KEY_ZEROX_FEE_BPS = 'ZEROX_FEE_BPS';
const ENV_KEY_ZEROX_FEE_TOKEN_MODE = 'ZEROX_FEE_TOKEN_MODE';
const ENV_KEY_PARASWAP_FEE_BPS = 'PARASWAP_FEE_BPS';
const ENV_KEY_PARASWAP_API_VERSION = 'PARASWAP_API_VERSION';
const ENV_KEY_JUPITER_PLATFORM_FEE_BPS = 'JUPITER_PLATFORM_FEE_BPS';
const ENV_KEY_ODOS_MONETIZATION_MODE = 'ODOS_MONETIZATION_MODE';
const MIN_PORT = 1;
const MAX_PORT = 65_535;
const MIN_CACHE_TTL = 1;
const MIN_SWAP_TIMEOUT_SECONDS = 1;
const MIN_SLIPPAGE = 0;
const MIN_FEE_BPS = 0;
const MAX_FEE_BPS = 10_000;
const MAX_PARASWAP_FEE_BPS = 200;
const DEFAULT_CACHE_TTL_PRICE = 30;
const DEFAULT_SWAP_TIMEOUT_SECONDS = 300;
const DEFAULT_SWAP_SLIPPAGE = 0.5;
const ALLOWED_ZEROX_FEE_TOKEN_MODES = ['auto', 'buy', 'sell'] as const;
const ALLOWED_ODOS_MONETIZATION_MODES = ['disabled', 'tracking_only', 'enforced'] as const;

const ALLOWED_NODE_ENVS = ['development', 'production', 'test'] as const;

export type NodeEnvironment = (typeof ALLOWED_NODE_ENVS)[number];

type EnvironmentSource = Record<string, unknown>;
type EnvironmentResult = Record<string, unknown>;

function getRequiredString(source: EnvironmentSource, key: string): string {
  const value = source[key];

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Environment variable "${key}" is required`);
  }

  return value;
}

function getOptionalString(source: EnvironmentSource, key: string): string | undefined {
  const value = source[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error(`Environment variable "${key}" must be a string`);
  }

  return value.trim() === '' ? undefined : value.trim();
}

function getOptionalHttpUrl(source: EnvironmentSource, key: string): string | undefined {
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

function validateNodeEnvironment(value: string): NodeEnvironment {
  if (ALLOWED_NODE_ENVS.includes(value as NodeEnvironment)) {
    return value as NodeEnvironment;
  }

  throw new Error(
    `Environment variable "${ENV_KEY_NODE_ENV}" must be one of: ${ALLOWED_NODE_ENVS.join(', ')}`,
  );
}

function validatePort(value: string): number {
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

function getBoolean(source: EnvironmentSource, key: string, fallback: boolean): boolean {
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

function getPositiveInteger(
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

function getPositiveNumber(
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

function validateOptionalBps(
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

function validateOptionalEnum(
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

function validateFeeEnvironment(source: EnvironmentSource): EnvironmentResult {
  return {
    [ENV_KEY_ZEROX_FEE_BPS]:
      validateOptionalBps(source, ENV_KEY_ZEROX_FEE_BPS, MAX_FEE_BPS) ??
      source[ENV_KEY_ZEROX_FEE_BPS],
    [ENV_KEY_ZEROX_FEE_TOKEN_MODE]:
      validateOptionalEnum(source, ENV_KEY_ZEROX_FEE_TOKEN_MODE, ALLOWED_ZEROX_FEE_TOKEN_MODES) ??
      source[ENV_KEY_ZEROX_FEE_TOKEN_MODE],
    [ENV_KEY_PARASWAP_FEE_BPS]:
      validateOptionalBps(source, ENV_KEY_PARASWAP_FEE_BPS, MAX_PARASWAP_FEE_BPS) ??
      source[ENV_KEY_PARASWAP_FEE_BPS],
    [ENV_KEY_PARASWAP_API_VERSION]:
      getOptionalString(source, ENV_KEY_PARASWAP_API_VERSION) ??
      source[ENV_KEY_PARASWAP_API_VERSION],
    [ENV_KEY_JUPITER_PLATFORM_FEE_BPS]:
      validateOptionalBps(source, ENV_KEY_JUPITER_PLATFORM_FEE_BPS, MAX_FEE_BPS) ??
      source[ENV_KEY_JUPITER_PLATFORM_FEE_BPS],
    [ENV_KEY_ODOS_MONETIZATION_MODE]:
      validateOptionalEnum(
        source,
        ENV_KEY_ODOS_MONETIZATION_MODE,
        ALLOWED_ODOS_MONETIZATION_MODES,
      ) ?? source[ENV_KEY_ODOS_MONETIZATION_MODE],
  };
}

export function validateEnvironment(source: EnvironmentSource): EnvironmentResult {
  const nodeEnv = validateNodeEnvironment(getRequiredString(source, ENV_KEY_NODE_ENV));
  const port = validatePort(getRequiredString(source, ENV_KEY_PORT));
  const databaseUrl = getRequiredString(source, ENV_KEY_DATABASE_URL);
  const telegramEnabled = getBoolean(source, ENV_KEY_TELEGRAM_ENABLED, false);
  const metricsEnabled = getBoolean(source, ENV_KEY_METRICS_ENABLED, true);
  const cacheTtlPrice = getPositiveInteger(
    source,
    ENV_KEY_CACHE_TTL_PRICE,
    DEFAULT_CACHE_TTL_PRICE,
    MIN_CACHE_TTL,
  );
  const walletConnectProjectId = getOptionalString(source, ENV_KEY_WC_PROJECT_ID);
  const appPublicUrl = getOptionalHttpUrl(source, ENV_KEY_APP_PUBLIC_URL);
  const swapTimeoutSeconds = getPositiveInteger(
    source,
    ENV_KEY_SWAP_TIMEOUT_SECONDS,
    DEFAULT_SWAP_TIMEOUT_SECONDS,
    MIN_SWAP_TIMEOUT_SECONDS,
  );
  const swapSlippage = getPositiveNumber(
    source,
    ENV_KEY_SWAP_SLIPPAGE,
    DEFAULT_SWAP_SLIPPAGE,
    MIN_SLIPPAGE,
  );
  const feeEnvironment = validateFeeEnvironment(source);

  let telegramBotToken: string | undefined;

  if (telegramEnabled) {
    telegramBotToken = getRequiredString(source, ENV_KEY_TELEGRAM_BOT_TOKEN);
  }

  return {
    ...source,
    [ENV_KEY_NODE_ENV]: nodeEnv,
    [ENV_KEY_PORT]: port,
    [ENV_KEY_DATABASE_URL]: databaseUrl,
    [ENV_KEY_TELEGRAM_ENABLED]: telegramEnabled.toString(),
    [ENV_KEY_METRICS_ENABLED]: metricsEnabled.toString(),
    [ENV_KEY_CACHE_TTL_PRICE]: cacheTtlPrice.toString(),
    [ENV_KEY_WC_PROJECT_ID]: walletConnectProjectId ?? source[ENV_KEY_WC_PROJECT_ID],
    [ENV_KEY_APP_PUBLIC_URL]: appPublicUrl ?? source[ENV_KEY_APP_PUBLIC_URL],
    [ENV_KEY_SWAP_TIMEOUT_SECONDS]: swapTimeoutSeconds.toString(),
    [ENV_KEY_SWAP_SLIPPAGE]: swapSlippage.toString(),
    ...feeEnvironment,
    [ENV_KEY_TELEGRAM_BOT_TOKEN]: telegramBotToken ?? source[ENV_KEY_TELEGRAM_BOT_TOKEN],
  };
}
