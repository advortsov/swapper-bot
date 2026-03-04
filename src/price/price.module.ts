import { Module } from '@nestjs/common';

import { PriceCache } from './price.cache';
import { PriceProvidersService } from './price.providers.service';
import { PriceQuoteService } from './price.quote.service';
import { PriceRankingService } from './price.ranking.service';
import { PriceRepository } from './price.repository';
import { PriceResultBuilder } from './price.result-builder';
import { PriceRuntimeService } from './price.runtime.service';
import { PriceService } from './price.service';
import { PriceTokenResolutionService } from './price.token-resolution.service';
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
  providers: [
    PriceCache,
    PriceRepository,
    PriceTokenResolutionService,
    PriceProvidersService,
    PriceRankingService,
    PriceResultBuilder,
    PriceQuoteService,
    PriceRuntimeService,
    PriceService,
  ],
  exports: [PriceService, PriceQuoteService],
})
export class PriceModule {}
