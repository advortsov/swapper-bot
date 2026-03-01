import { Module } from '@nestjs/common';

import { FeePolicyService } from './fee-policy.service';
import { QuoteMonetizationService } from './quote-monetization.service';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [MetricsModule],
  providers: [FeePolicyService, QuoteMonetizationService],
  exports: [FeePolicyService, QuoteMonetizationService],
})
export class FeesModule {}
