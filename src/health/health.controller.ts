import { Controller, Get, Inject } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import { appConfig } from '../config/app.config';

interface IHealthResponse {
  status: 'ok';
  service: string;
  version: string;
  environment: string;
}

@Controller('health')
export class HealthController {
  public constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) {}

  @Get()
  public getHealth(): IHealthResponse {
    return {
      status: 'ok',
      service: this.config.serviceName,
      version: this.config.version,
      environment: this.config.nodeEnv,
    };
  }
}
