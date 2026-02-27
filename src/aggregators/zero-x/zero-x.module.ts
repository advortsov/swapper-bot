import { Module } from '@nestjs/common';

import { ZeroXAggregator } from './zero-x.aggregator';
import { MetricsModule } from '../../metrics/metrics.module';

@Module({
  imports: [MetricsModule],
  providers: [ZeroXAggregator],
  exports: [ZeroXAggregator],
})
export class ZeroXModule {}
