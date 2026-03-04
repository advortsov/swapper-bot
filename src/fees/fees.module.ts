import { Module } from '@nestjs/common';

import { FeePolicyConfigService } from './fee-policy.config.service';
import { FeePolicyDisabledService } from './fee-policy.disabled.service';
import { FeePolicyJupiterService } from './fee-policy.jupiter.service';
import { FeePolicyOdosService } from './fee-policy.odos.service';
import { FeePolicyParaSwapService } from './fee-policy.paraswap.service';
import { FeePolicyService } from './fee-policy.service';
import { FeePolicyZeroXService } from './fee-policy.zerox.service';
import { QuoteMonetizationService } from './quote-monetization.service';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [MetricsModule],
  providers: [
    FeePolicyConfigService,
    FeePolicyDisabledService,
    FeePolicyJupiterService,
    FeePolicyOdosService,
    FeePolicyParaSwapService,
    FeePolicyService,
    FeePolicyZeroXService,
    QuoteMonetizationService,
  ],
  exports: [FeePolicyService, QuoteMonetizationService],
})
export class FeesModule {}
