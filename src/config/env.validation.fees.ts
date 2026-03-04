import {
  ALLOWED_ODOS_MONETIZATION_MODES,
  ALLOWED_ODOS_MONETIZED_CHAINS,
  ALLOWED_ZEROX_FEE_TOKEN_MODES,
  ENV_KEY_JUPITER_PLATFORM_FEE_BPS,
  ENV_KEY_ODOS_MONETIZATION_MODE,
  ENV_KEY_ODOS_MONETIZED_CHAINS,
  ENV_KEY_ODOS_REFERRAL_CODE,
  ENV_KEY_PARASWAP_API_VERSION,
  ENV_KEY_PARASWAP_FEE_BPS,
  ENV_KEY_PARASWAP_PARTNER_ADDRESS,
  ENV_KEY_ZEROX_FEE_BPS,
  ENV_KEY_ZEROX_FEE_RECIPIENT,
  ENV_KEY_ZEROX_FEE_TOKEN_MODE,
  JUPITER_FEE_ACCOUNT_KEYS,
  MAX_FEE_BPS,
  MAX_PARASWAP_FEE_BPS,
  PARASWAP_SUPPORTED_API_VERSION,
  type EnvironmentResult,
  type EnvironmentSource,
} from './env.validation.constants';
import {
  getOptionalString,
  getRequiredString,
  parseOptionalInteger,
  validateOptionalBps,
  validateOptionalCsv,
  validateOptionalEnum,
  validateOptionalPositiveInteger,
} from './env.validation.parsers';

function validateZeroXFeeConfig(source: EnvironmentSource, zeroXFeeBps: string | undefined): void {
  if (parseOptionalInteger(zeroXFeeBps) > 0) {
    getRequiredString(source, ENV_KEY_ZEROX_FEE_RECIPIENT);
  }
}

function validateParaSwapFeeConfig(
  source: EnvironmentSource,
  paraswapFeeBps: string | undefined,
  paraswapApiVersion: string | undefined,
): void {
  if (parseOptionalInteger(paraswapFeeBps) > 0) {
    getRequiredString(source, ENV_KEY_PARASWAP_PARTNER_ADDRESS);
  }

  if (paraswapApiVersion !== undefined && paraswapApiVersion !== PARASWAP_SUPPORTED_API_VERSION) {
    throw new Error(
      `Environment variable "${ENV_KEY_PARASWAP_API_VERSION}" must be "${PARASWAP_SUPPORTED_API_VERSION}"`,
    );
  }
}

function validateJupiterFeeConfig(
  source: EnvironmentSource,
  jupiterFeeBps: string | undefined,
): void {
  if (parseOptionalInteger(jupiterFeeBps) === 0) {
    return;
  }

  const hasAnyJupiterFeeAccount = JUPITER_FEE_ACCOUNT_KEYS.some(
    (key) => getOptionalString(source, key) !== undefined,
  );

  if (!hasAnyJupiterFeeAccount) {
    throw new Error(
      'At least one JUPITER_FEE_ACCOUNT_<SYMBOL> must be configured when JUPITER_PLATFORM_FEE_BPS is greater than 0',
    );
  }
}

function validateOdosFeeConfig(
  odosMode: string | undefined,
  odosReferralCode: string | undefined,
): void {
  if (odosMode === 'enforced' && odosReferralCode === undefined) {
    throw new Error(`Environment variable "${ENV_KEY_ODOS_REFERRAL_CODE}" is required`);
  }
}

export function validateFeeEnvironment(source: EnvironmentSource): EnvironmentResult {
  const zeroXFeeBps = getOptionalString(source, ENV_KEY_ZEROX_FEE_BPS);
  const paraswapFeeBps = getOptionalString(source, ENV_KEY_PARASWAP_FEE_BPS);
  const paraswapApiVersion = getOptionalString(source, ENV_KEY_PARASWAP_API_VERSION);
  const jupiterFeeBps = getOptionalString(source, ENV_KEY_JUPITER_PLATFORM_FEE_BPS);
  const odosMode = getOptionalString(source, ENV_KEY_ODOS_MONETIZATION_MODE);
  const odosReferralCode = getOptionalString(source, ENV_KEY_ODOS_REFERRAL_CODE);

  const feeEnvironment = {
    [ENV_KEY_ZEROX_FEE_BPS]:
      validateOptionalBps(source, ENV_KEY_ZEROX_FEE_BPS, MAX_FEE_BPS) ??
      source[ENV_KEY_ZEROX_FEE_BPS],
    [ENV_KEY_ZEROX_FEE_TOKEN_MODE]:
      validateOptionalEnum(source, ENV_KEY_ZEROX_FEE_TOKEN_MODE, ALLOWED_ZEROX_FEE_TOKEN_MODES) ??
      source[ENV_KEY_ZEROX_FEE_TOKEN_MODE],
    [ENV_KEY_PARASWAP_FEE_BPS]:
      validateOptionalBps(source, ENV_KEY_PARASWAP_FEE_BPS, MAX_PARASWAP_FEE_BPS) ??
      source[ENV_KEY_PARASWAP_FEE_BPS],
    [ENV_KEY_PARASWAP_API_VERSION]: paraswapApiVersion ?? source[ENV_KEY_PARASWAP_API_VERSION],
    [ENV_KEY_JUPITER_PLATFORM_FEE_BPS]:
      validateOptionalBps(source, ENV_KEY_JUPITER_PLATFORM_FEE_BPS, MAX_FEE_BPS) ??
      source[ENV_KEY_JUPITER_PLATFORM_FEE_BPS],
    [ENV_KEY_ODOS_MONETIZATION_MODE]:
      validateOptionalEnum(
        source,
        ENV_KEY_ODOS_MONETIZATION_MODE,
        ALLOWED_ODOS_MONETIZATION_MODES,
      ) ?? source[ENV_KEY_ODOS_MONETIZATION_MODE],
    [ENV_KEY_ODOS_REFERRAL_CODE]:
      validateOptionalPositiveInteger(source, ENV_KEY_ODOS_REFERRAL_CODE) ??
      source[ENV_KEY_ODOS_REFERRAL_CODE],
    [ENV_KEY_ODOS_MONETIZED_CHAINS]:
      validateOptionalCsv(source, ENV_KEY_ODOS_MONETIZED_CHAINS, ALLOWED_ODOS_MONETIZED_CHAINS) ??
      source[ENV_KEY_ODOS_MONETIZED_CHAINS],
  };

  validateZeroXFeeConfig(source, zeroXFeeBps);
  validateParaSwapFeeConfig(source, paraswapFeeBps, paraswapApiVersion);
  validateJupiterFeeConfig(source, jupiterFeeBps);
  validateOdosFeeConfig(odosMode, odosReferralCode);

  return feeEnvironment;
}
