import { Module } from '@nestjs/common';

import { AssetAlertsService } from './asset-alerts.service';
import { PriceAlertsRepository } from './price-alerts.repository';
import { PriceAlertsService } from './price-alerts.service';
import { PriceAlertsWorker } from './price-alerts.worker';
import { DatabaseModule } from '../database/database.module';
import { FavoritePairsRepository } from '../favorites/favorite-pairs.repository';
import { FavoritesModule } from '../favorites/favorites.module';
import { PriceModule } from '../price/price.module';
import { TokensRepository } from '../tokens/tokens.repository';

@Module({
  imports: [FavoritesModule, PriceModule, DatabaseModule],
  providers: [
    PriceAlertsRepository,
    PriceAlertsService,
    PriceAlertsWorker,
    AssetAlertsService,
    TokensRepository,
    FavoritePairsRepository,
  ],
  exports: [PriceAlertsService, PriceAlertsWorker, AssetAlertsService],
})
export class AlertsModule {}
