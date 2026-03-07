import { Module } from '@nestjs/common';

import { TradePresetsService } from './trade-presets.service';

@Module({
  providers: [TradePresetsService],
  exports: [TradePresetsService],
})
export class TradePresetsModule {}
