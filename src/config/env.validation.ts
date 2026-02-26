const ENV_KEY_NODE_ENV = 'NODE_ENV';
const ENV_KEY_PORT = 'PORT';
const ENV_KEY_DATABASE_URL = 'DATABASE_URL';
const MIN_PORT = 1;
const MAX_PORT = 65_535;

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

export function validateEnvironment(source: EnvironmentSource): EnvironmentResult {
  const nodeEnv = validateNodeEnvironment(getRequiredString(source, ENV_KEY_NODE_ENV));
  const port = validatePort(getRequiredString(source, ENV_KEY_PORT));
  const databaseUrl = getRequiredString(source, ENV_KEY_DATABASE_URL);

  return {
    ...source,
    [ENV_KEY_NODE_ENV]: nodeEnv,
    [ENV_KEY_PORT]: port,
    [ENV_KEY_DATABASE_URL]: databaseUrl,
  };
}
