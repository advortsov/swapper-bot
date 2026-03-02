import { Module } from '@nestjs/common';

import { FavoritePairsRepository } from './favorite-pairs.repository';
import { FavoritesService } from './favorites.service';
import { PriceModule } from '../price/price.module';

@Module({
  imports: [PriceModule],
  providers: [FavoritePairsRepository, FavoritesService],
  exports: [FavoritesService],
})
export class FavoritesModule {}
