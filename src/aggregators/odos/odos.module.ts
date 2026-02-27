import { Module } from '@nestjs/common';

import { OdosAggregator } from './odos.aggregator';
import { MetricsModule } from '../../metrics/metrics.module';

@Module({
  imports: [MetricsModule],
  providers: [OdosAggregator],
  exports: [OdosAggregator],
})
export class OdosModule {}
