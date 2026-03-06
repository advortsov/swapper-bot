import {
  DEFAULT_CACHE_TTL_PRICE,
  DEFAULT_MAX_ACTIVE_PRICE_ALERTS_PER_USER,
  DEFAULT_PRICE_ALERTS_POLL_INTERVAL,
  DEFAULT_SWAP_SLIPPAGE,
  DEFAULT_SWAP_TIMEOUT_SECONDS,
  DEFAULT_TELEGRAM_PENDING_ACTION_TTL_SECONDS,
  DEFAULT_TX_TRACKING_POLL_INTERVAL,
  DEFAULT_TX_TRACKING_TIMEOUT,
  DEFAULT_WALLET_CONNECT_SESSION_TTL_SECONDS,
  ENV_KEY_APP_PUBLIC_URL,
  ENV_KEY_CACHE_TTL_PRICE,
  ENV_KEY_COINGECKO_API_BASE_URL,
  ENV_KEY_DATABASE_URL,
  ENV_KEY_MAX_ACTIVE_PRICE_ALERTS_PER_USER,
  ENV_KEY_METRICS_ENABLED,
  ENV_KEY_NODE_ENV,
  ENV_KEY_PORT,
  ENV_KEY_PRICE_ALERTS_POLL_INTERVAL_SEC,
  ENV_KEY_SWAP_SLIPPAGE,
  ENV_KEY_SWAP_TIMEOUT_SECONDS,
  ENV_KEY_TELEGRAM_BOT_TOKEN,
  ENV_KEY_TELEGRAM_ENABLED,
  ENV_KEY_TELEGRAM_PENDING_ACTION_TTL_SEC,
  ENV_KEY_TX_TRACKING_ENABLED,
  ENV_KEY_TX_TRACKING_POLL_INTERVAL_SEC,
  ENV_KEY_TX_TRACKING_TIMEOUT_SEC,
  ENV_KEY_WALLET_CONNECT_SESSION_TTL_SEC,
  ENV_KEY_WC_PROJECT_ID,
  MIN_CACHE_TTL,
  MIN_SLIPPAGE,
  MIN_SWAP_TIMEOUT_SECONDS,
  MIN_TX_TRACKING_POLL_INTERVAL,
  MIN_TX_TRACKING_TIMEOUT,
  type EnvironmentResult,
  type EnvironmentSource,
} from './env.validation.constants';
import { validateFeeEnvironment } from './env.validation.fees';
import {
  getBoolean,
  getOptionalHttpUrl,
  getOptionalString,
  getPositiveInteger,
  getPositiveNumber,
  getRequiredString,
  validateNodeEnvironment,
  validatePort,
} from './env.validation.parsers';

export { type NodeEnvironment } from './env.validation.constants';

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
  const walletConnectSessionTtl = getPositiveInteger(
    source,
    ENV_KEY_WALLET_CONNECT_SESSION_TTL_SEC,
    DEFAULT_WALLET_CONNECT_SESSION_TTL_SECONDS,
    MIN_SWAP_TIMEOUT_SECONDS,
  );
  const telegramPendingActionTtl = getPositiveInteger(
    source,
    ENV_KEY_TELEGRAM_PENDING_ACTION_TTL_SEC,
    DEFAULT_TELEGRAM_PENDING_ACTION_TTL_SECONDS,
    MIN_SWAP_TIMEOUT_SECONDS,
  );
  const priceAlertsPollInterval = getPositiveInteger(
    source,
    ENV_KEY_PRICE_ALERTS_POLL_INTERVAL_SEC,
    DEFAULT_PRICE_ALERTS_POLL_INTERVAL,
    MIN_SWAP_TIMEOUT_SECONDS,
  );
  const maxActivePriceAlerts = getPositiveInteger(
    source,
    ENV_KEY_MAX_ACTIVE_PRICE_ALERTS_PER_USER,
    DEFAULT_MAX_ACTIVE_PRICE_ALERTS_PER_USER,
    MIN_SWAP_TIMEOUT_SECONDS,
  );
  const coinGeckoApiBaseUrl = getOptionalHttpUrl(source, ENV_KEY_COINGECKO_API_BASE_URL);
  const swapSlippage = getPositiveNumber(
    source,
    ENV_KEY_SWAP_SLIPPAGE,
    DEFAULT_SWAP_SLIPPAGE,
    MIN_SLIPPAGE,
  );
  const txTrackingEnvironment = validateTxTrackingEnvironment(source);
  const feeEnvironment = validateFeeEnvironment(source);
  const telegramBotToken = telegramEnabled
    ? getRequiredString(source, ENV_KEY_TELEGRAM_BOT_TOKEN)
    : undefined;

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
    [ENV_KEY_WALLET_CONNECT_SESSION_TTL_SEC]: walletConnectSessionTtl.toString(),
    [ENV_KEY_TELEGRAM_PENDING_ACTION_TTL_SEC]: telegramPendingActionTtl.toString(),
    [ENV_KEY_PRICE_ALERTS_POLL_INTERVAL_SEC]: priceAlertsPollInterval.toString(),
    [ENV_KEY_MAX_ACTIVE_PRICE_ALERTS_PER_USER]: maxActivePriceAlerts.toString(),
    [ENV_KEY_COINGECKO_API_BASE_URL]: coinGeckoApiBaseUrl ?? source[ENV_KEY_COINGECKO_API_BASE_URL],
    [ENV_KEY_SWAP_SLIPPAGE]: swapSlippage.toString(),
    ...feeEnvironment,
    [ENV_KEY_TELEGRAM_BOT_TOKEN]: telegramBotToken ?? source[ENV_KEY_TELEGRAM_BOT_TOKEN],
    ...txTrackingEnvironment,
  };
}

function validateTxTrackingEnvironment(source: EnvironmentSource): EnvironmentResult {
  return {
    [ENV_KEY_TX_TRACKING_ENABLED]: getBoolean(source, ENV_KEY_TX_TRACKING_ENABLED, true).toString(),
    [ENV_KEY_TX_TRACKING_POLL_INTERVAL_SEC]: getPositiveInteger(
      source,
      ENV_KEY_TX_TRACKING_POLL_INTERVAL_SEC,
      DEFAULT_TX_TRACKING_POLL_INTERVAL,
      MIN_TX_TRACKING_POLL_INTERVAL,
    ).toString(),
    [ENV_KEY_TX_TRACKING_TIMEOUT_SEC]: getPositiveInteger(
      source,
      ENV_KEY_TX_TRACKING_TIMEOUT_SEC,
      DEFAULT_TX_TRACKING_TIMEOUT,
      MIN_TX_TRACKING_TIMEOUT,
    ).toString(),
  };
}
