import { Module } from '@nestjs/common';

import { TelegramBot } from './telegram.bot';
import { TelegramConnectionsLinksService } from './telegram.connections-links.service';
import { TelegramConnectionsParserService } from './telegram.connections-parser.service';
import { TelegramConnectionsReplyService } from './telegram.connections-reply.service';
import { TelegramConnectionsService } from './telegram.connections.service';
import { TelegramPortfolioAlertsService } from './telegram.portfolio-alerts.service';
import { TelegramPortfolioFavoritesService } from './telegram.portfolio-favorites.service';
import { TelegramPortfolioHistoryService } from './telegram.portfolio-history.service';
import { TelegramPortfolioParserService } from './telegram.portfolio-parser.service';
import { TelegramPortfolioService } from './telegram.portfolio.service';
import { TelegramQrService } from './telegram.qr.service';
import { TelegramSettingsHandler } from './telegram.settings-handler';
import { TelegramTradingApproveService } from './telegram.trading-approve.service';
import { TelegramTradingButtonsService } from './telegram.trading-buttons.service';
import { TelegramTradingParserService } from './telegram.trading-parser.service';
import { TelegramTradingQuoteService } from './telegram.trading-quote.service';
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
    TelegramConnectionsLinksService,
    TelegramConnectionsParserService,
    TelegramConnectionsReplyService,
    TelegramConnectionsService,
    TelegramQrService,
    TelegramPortfolioAlertsService,
    TelegramPortfolioFavoritesService,
    TelegramPortfolioHistoryService,
    TelegramPortfolioParserService,
    TelegramPortfolioService,
    TelegramTradingApproveService,
    TelegramTradingButtonsService,
    TelegramTradingParserService,
    TelegramTradingQuoteService,
    TelegramTradingService,
    TelegramUpdateHandler,
    TelegramBot,
  ],
})
export class TelegramModule {}
