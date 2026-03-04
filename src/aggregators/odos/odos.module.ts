import { Module } from '@nestjs/common';

import { OdosAggregator } from './odos.aggregator';
import { OdosExecutionBuilder } from './odos.execution-builder';
import { OdosMonetizationService } from './odos.monetization.service';
import { OdosResponseMapper } from './odos.response-mapper';
import { MetricsModule } from '../../metrics/metrics.module';

@Module({
  imports: [MetricsModule],
  providers: [OdosAggregator, OdosExecutionBuilder, OdosMonetizationService, OdosResponseMapper],
  exports: [OdosAggregator],
})
export class OdosModule {}
