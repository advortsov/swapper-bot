import { Module } from '@nestjs/common';

import { TelegramBot } from './telegram.bot';
import { TelegramCallbackRouterService } from './telegram.callback-router.service';
import { TelegramCommandRouterService } from './telegram.command-router.service';
import { TelegramConnectionsLinksService } from './telegram.connections-links.service';
import { TelegramConnectionsParserService } from './telegram.connections-parser.service';
import { TelegramConnectionsReplyService } from './telegram.connections-reply.service';
import { TelegramConnectionsService } from './telegram.connections.service';
import { TelegramErrorReplyService } from './telegram.error-reply.service';
import { TelegramPortfolioAlertsService } from './telegram.portfolio-alerts.service';
import { TelegramPortfolioBalanceService } from './telegram.portfolio-balance.service';
import { TelegramPortfolioFavoritesService } from './telegram.portfolio-favorites.service';
import { TelegramPortfolioHistoryService } from './telegram.portfolio-history.service';
import { TelegramPortfolioParserService } from './telegram.portfolio-parser.service';
import { TelegramPortfolioService } from './telegram.portfolio.service';
import { TelegramQrService } from './telegram.qr.service';
import { TelegramSettingsHandler } from './telegram.settings-handler';
import { TelegramSettingsMenuService } from './telegram.settings-menu.service';
import { TelegramSettingsParserService } from './telegram.settings-parser.service';
import { TelegramSettingsPersistenceService } from './telegram.settings-persistence.service';
import { TelegramSettingsReplyService } from './telegram.settings-reply.service';
import { TelegramStartHelpService } from './telegram.start-help.service';
import { TelegramTradeTemplatesService } from './telegram.trade-templates.service';
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
import { PortfolioModule } from '../portfolio/portfolio.module';
import { PriceModule } from '../price/price.module';
import { SettingsModule } from '../settings/settings.module';
import { SwapModule } from '../swap/swap.module';
import { TokensModule } from '../tokens/tokens.module';
import { TradePresetsModule } from '../trade-presets/trade-presets.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { WalletConnectModule } from '../wallet-connect/wallet-connect.module';

@Module({
  imports: [
    PriceModule,
    SwapModule,
    SettingsModule,
    FavoritesModule,
    AlertsModule,
    HistoryModule,
    TransactionsModule,
    WalletConnectModule,
    AllowanceModule,
    PortfolioModule,
    TokensModule,
    TradePresetsModule,
  ],
  providers: [
    TelegramSettingsHandler,
    TelegramCommandRouterService,
    TelegramCallbackRouterService,
    TelegramErrorReplyService,
    TelegramStartHelpService,
    TelegramSettingsMenuService,
    TelegramSettingsParserService,
    TelegramSettingsPersistenceService,
    TelegramSettingsReplyService,
    TelegramConnectionsLinksService,
    TelegramConnectionsParserService,
    TelegramConnectionsReplyService,
    TelegramConnectionsService,
    TelegramQrService,
    TelegramPortfolioAlertsService,
    TelegramPortfolioFavoritesService,
    TelegramPortfolioHistoryService,
    TelegramPortfolioBalanceService,
    TelegramPortfolioParserService,
    TelegramPortfolioService,
    TelegramTradeTemplatesService,
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
