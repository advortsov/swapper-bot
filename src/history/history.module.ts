import { Module } from '@nestjs/common';

import { SwapHistoryService } from './swap-history.service';
import { ChainsModule } from '../chains/chains.module';

@Module({
  imports: [ChainsModule],
  providers: [SwapHistoryService],
  exports: [SwapHistoryService],
})
export class HistoryModule {}
