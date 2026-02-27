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
  const swapSlippage = Number.parseFloat(getEnvValue('SWAP_SLIPPAGE', SWAP_SLIPPAGE_DEFAULT));

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
    swapSlippage,
  };
});
