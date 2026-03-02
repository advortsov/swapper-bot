import { Module } from '@nestjs/common';

import { PriceCache } from './price.cache';
import { PriceQuoteService } from './price.quote.service';
import { PriceRepository } from './price.repository';
import { PriceRuntimeService } from './price.runtime.service';
import { PriceService } from './price.service';
import { AggregatorsModule } from '../aggregators/aggregators.module';
import { ChainsModule } from '../chains/chains.module';
import { FeesModule } from '../fees/fees.module';
import { SettingsModule } from '../settings/settings.module';
import { TokenResolutionModule } from '../token-resolution/token-resolution.module';
import { TokensModule } from '../tokens/tokens.module';

@Module({
  imports: [
    TokensModule,
    ChainsModule,
    AggregatorsModule,
    FeesModule,
    SettingsModule,
    TokenResolutionModule,
  ],
  providers: [PriceCache, PriceRepository, PriceQuoteService, PriceRuntimeService, PriceService],
  exports: [PriceService, PriceQuoteService],
})
export class PriceModule {}
