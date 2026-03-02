import { Module } from '@nestjs/common';

import { SwapHistoryService } from './swap-history.service';

@Module({
  providers: [SwapHistoryService],
  exports: [SwapHistoryService],
})
export class HistoryModule {}
