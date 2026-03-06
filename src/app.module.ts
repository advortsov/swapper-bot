import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AggregatorsModule } from './aggregators/aggregators.module';
import { AlertsModule } from './alerts/alerts.module';
import { AllowanceModule } from './allowance/allowance.module';
import { ChainsModule } from './chains/chains.module';
import { appConfig } from './config/app.config';
import { validateEnvironment } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { FavoritesModule } from './favorites/favorites.module';
import { HealthModule } from './health/health.module';
import { HistoryModule } from './history/history.module';
import { MetricsModule } from './metrics/metrics.module';
import { PriceModule } from './price/price.module';
import { SwapModule } from './swap/swap.module';
import { TelegramModule } from './telegram/telegram.module';
import { TokensModule } from './tokens/tokens.module';
import { TransactionsModule } from './transactions/transactions.module';
import { WalletConnectModule } from './wallet-connect/wallet-connect.module';

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
    AllowanceModule,
    TokensModule,
    PriceModule,
    FavoritesModule,
    AlertsModule,
    HistoryModule,
    TransactionsModule,
    WalletConnectModule,
    SwapModule,
    TelegramModule,
    HealthModule,
  ],
})
export class AppModule {}
