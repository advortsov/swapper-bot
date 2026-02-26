import { registerAs } from '@nestjs/config';

import type { NodeEnvironment } from './env.validation';

const APP_CONFIG_NAMESPACE = 'app';
const APP_VERSION_DEFAULT = '0.1.0';
const APP_PORT_DEFAULT = '3000';
const SERVICE_NAME = 'swapper-bot';

export const appConfig = registerAs(APP_CONFIG_NAMESPACE, () => {
  const nodeEnv = (process.env['NODE_ENV'] ?? 'development') as NodeEnvironment;
  const port = Number.parseInt(process.env['PORT'] ?? APP_PORT_DEFAULT, 10);
  const version = process.env['APP_VERSION'] ?? APP_VERSION_DEFAULT;

  return {
    serviceName: SERVICE_NAME,
    nodeEnv,
    port,
    version,
  };
});
