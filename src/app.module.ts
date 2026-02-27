import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AggregatorsModule } from './aggregators/aggregators.module';
import { ChainsModule } from './chains/chains.module';
import { appConfig } from './config/app.config';
import { validateEnvironment } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { PriceModule } from './price/price.module';
import { TelegramModule } from './telegram/telegram.module';
import { TokensModule } from './tokens/tokens.module';

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
    DatabaseModule,
    MetricsModule,
    ChainsModule,
    AggregatorsModule,
    TokensModule,
    PriceModule,
    TelegramModule,
    HealthModule,
  ],
})
export class AppModule {}
