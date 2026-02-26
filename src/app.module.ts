import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { appConfig } from './config/app.config';
import { validateEnvironment } from './config/env.validation';
import { HealthModule } from './health/health.module';

const nodeEnvironment = process.env['NODE_ENV'] ?? 'development';
const envFilePath = [
  `.env.${nodeEnvironment}.local`,
  `.env.${nodeEnvironment}`,
  '.env.local',
  '.env',
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig],
      validate: validateEnvironment,
      envFilePath,
    }),
    HealthModule,
  ],
})
export class AppModule {}
