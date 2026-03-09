import { registerAs } from '@nestjs/config';

import type { NodeEnvironment } from './env.validation';

const APP_CONFIG_NAMESPACE = 'app';
const APP_VERSION_DEFAULT = '0.1.0';
const APP_PORT_DEFAULT = '3000';
const SERVICE_NAME = 'swapper-bot';
const TELEGRAM_ENABLED_DEFAULT = 'false';
const METRICS_ENABLED_DEFAULT = 'true';
const CACHE_TTL_DEFAULT = '30';
const SWAP_TIMEOUT_SECONDS_DEFAULT = '300';
const SWAP_SLIPPAGE_DEFAULT = '0.5';
const APP_PUBLIC_URL_DEFAULT = 'https://example.org';
const WALLET_CONNECT_SESSION_TTL_DEFAULT = '604800';
const TELEGRAM_PENDING_ACTION_TTL_DEFAULT = '300';
const PRICE_ALERTS_POLL_INTERVAL_DEFAULT = '60';
const MAX_ACTIVE_PRICE_ALERTS_DEFAULT = '20';
const COINGECKO_API_BASE_URL_DEFAULT = 'https://api.coingecko.com/api/v3';

function getEnvValue(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const appConfig = registerAs(APP_CONFIG_NAMESPACE, () => {
  const nodeEnv = getEnvValue('NODE_ENV', 'development') as NodeEnvironment;
  const port = Number.parseInt(getEnvValue('PORT', APP_PORT_DEFAULT), 10);
  const version = getEnvValue('APP_VERSION', APP_VERSION_DEFAULT);
  const telegramEnabled = getEnvValue('TELEGRAM_ENABLED', TELEGRAM_ENABLED_DEFAULT) === 'true';
  const metricsEnabled = getEnvValue('METRICS_ENABLED', METRICS_ENABLED_DEFAULT) === 'true';
  const cacheTtlPrice = Number.parseInt(getEnvValue('CACHE_TTL_PRICE', CACHE_TTL_DEFAULT), 10);
  const walletConnectProjectId = getEnvValue('WC_PROJECT_ID', '');
  const appPublicUrl = getEnvValue('APP_PUBLIC_URL', APP_PUBLIC_URL_DEFAULT);
  const swapTimeoutSeconds = Number.parseInt(
    getEnvValue('SWAP_TIMEOUT_SECONDS', SWAP_TIMEOUT_SECONDS_DEFAULT),
    10,
  );
  const walletConnectSessionTtlSeconds = Number.parseInt(
    getEnvValue('WALLET_CONNECT_SESSION_TTL_SEC', WALLET_CONNECT_SESSION_TTL_DEFAULT),
    10,
  );
  const telegramPendingActionTtlSeconds = Number.parseInt(
    getEnvValue('TELEGRAM_PENDING_ACTION_TTL_SEC', TELEGRAM_PENDING_ACTION_TTL_DEFAULT),
    10,
  );
  const priceAlertsPollIntervalSeconds = Number.parseInt(
    getEnvValue('PRICE_ALERTS_POLL_INTERVAL_SEC', PRICE_ALERTS_POLL_INTERVAL_DEFAULT),
    10,
  );
  const maxActivePriceAlertsPerUser = Number.parseInt(
    getEnvValue('MAX_ACTIVE_PRICE_ALERTS_PER_USER', MAX_ACTIVE_PRICE_ALERTS_DEFAULT),
    10,
  );
  const coinGeckoApiBaseUrl = getEnvValue('COINGECKO_API_BASE_URL', COINGECKO_API_BASE_URL_DEFAULT);
  const swapSlippage = Number.parseFloat(getEnvValue('SWAP_SLIPPAGE', SWAP_SLIPPAGE_DEFAULT));
  const internalApiEnabled = getEnvValue('INTERNAL_API_ENABLED', 'false') === 'true';
  const internalApiToken = getEnvValue('INTERNAL_API_TOKEN', '');
  const internalApiAllowedIps = getEnvValue('INTERNAL_API_ALLOWED_IPS', '')
    .split(',')
    .map((ip) => ip.trim())
    .filter((ip) => ip.length > 0);

  return {
    serviceName: SERVICE_NAME,
    nodeEnv,
    port,
    version,
    telegramEnabled,
    metricsEnabled,
    cacheTtlPrice,
    walletConnectProjectId,
    appPublicUrl,
    swapTimeoutSeconds,
    walletConnectSessionTtlSeconds,
    telegramPendingActionTtlSeconds,
    priceAlertsPollIntervalSeconds,
    maxActivePriceAlertsPerUser,
    coinGeckoApiBaseUrl,
    swapSlippage,
    internalApiEnabled,
    internalApiToken,
    internalApiAllowedIps,
  };
});
