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

export const appConfig = registerAs(APP_CONFIG_NAMESPACE, () => {
  const nodeEnv = (process.env['NODE_ENV'] ?? 'development') as NodeEnvironment;
  const port = Number.parseInt(process.env['PORT'] ?? APP_PORT_DEFAULT, 10);
  const version = process.env['APP_VERSION'] ?? APP_VERSION_DEFAULT;
  const telegramEnabled =
    (process.env['TELEGRAM_ENABLED'] ?? TELEGRAM_ENABLED_DEFAULT).toLowerCase() === 'true';
  const metricsEnabled =
    (process.env['METRICS_ENABLED'] ?? METRICS_ENABLED_DEFAULT).toLowerCase() === 'true';
  const cacheTtlPrice = Number.parseInt(process.env['CACHE_TTL_PRICE'] ?? CACHE_TTL_DEFAULT, 10);
  const walletConnectProjectId = process.env['WC_PROJECT_ID'] ?? '';
  const swapTimeoutSeconds = Number.parseInt(
    process.env['SWAP_TIMEOUT_SECONDS'] ?? SWAP_TIMEOUT_SECONDS_DEFAULT,
    10,
  );
  const swapSlippage = Number.parseFloat(process.env['SWAP_SLIPPAGE'] ?? SWAP_SLIPPAGE_DEFAULT);

  return {
    serviceName: SERVICE_NAME,
    nodeEnv,
    port,
    version,
    telegramEnabled,
    metricsEnabled,
    cacheTtlPrice,
    walletConnectProjectId,
    swapTimeoutSeconds,
    swapSlippage,
  };
});
