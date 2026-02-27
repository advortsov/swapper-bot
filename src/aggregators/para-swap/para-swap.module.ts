import { Module } from '@nestjs/common';

import { ParaSwapAggregator } from './para-swap.aggregator';
import { MetricsModule } from '../../metrics/metrics.module';

@Module({
  imports: [MetricsModule],
  providers: [ParaSwapAggregator],
  exports: [ParaSwapAggregator],
})
export class ParaSwapModule {}
