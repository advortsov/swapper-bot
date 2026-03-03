import { Module } from '@nestjs/common';

import { TelegramBot } from './telegram.bot';
import { TelegramConnectionsService } from './telegram.connections.service';
import { TelegramPortfolioService } from './telegram.portfolio.service';
import { TelegramSettingsHandler } from './telegram.settings-handler';
import { TelegramTradingService } from './telegram.trading.service';
import { TelegramUpdateHandler } from './telegram.update-handler';
import { AlertsModule } from '../alerts/alerts.module';
import { AllowanceModule } from '../allowance/allowance.module';
import { FavoritesModule } from '../favorites/favorites.module';
import { HistoryModule } from '../history/history.module';
import { PriceModule } from '../price/price.module';
import { SettingsModule } from '../settings/settings.module';
import { SwapModule } from '../swap/swap.module';
import { WalletConnectModule } from '../wallet-connect/wallet-connect.module';

@Module({
  imports: [
    PriceModule,
    SwapModule,
    SettingsModule,
    FavoritesModule,
    AlertsModule,
    HistoryModule,
    WalletConnectModule,
    AllowanceModule,
  ],
  providers: [
    TelegramSettingsHandler,
    TelegramConnectionsService,
    TelegramPortfolioService,
    TelegramTradingService,
    TelegramUpdateHandler,
    TelegramBot,
  ],
})
export class TelegramModule {}
