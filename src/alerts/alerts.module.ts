import { Module } from '@nestjs/common';

import { PriceAlertsRepository } from './price-alerts.repository';
import { PriceAlertsService } from './price-alerts.service';
import { PriceAlertsWorker } from './price-alerts.worker';
import { FavoritesModule } from '../favorites/favorites.module';
import { PriceModule } from '../price/price.module';

@Module({
  imports: [FavoritesModule, PriceModule],
  providers: [PriceAlertsRepository, PriceAlertsService, PriceAlertsWorker],
  exports: [PriceAlertsService, PriceAlertsWorker],
})
export class AlertsModule {}
