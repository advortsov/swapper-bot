import { Module } from '@nestjs/common';

import { AGGREGATORS_TOKEN } from './aggregators.constants';
import { JupiterAggregator } from './jupiter/jupiter.aggregator';
import { JupiterModule } from './jupiter/jupiter.module';
import { OdosAggregator } from './odos/odos.aggregator';
import { OdosModule } from './odos/odos.module';
import { ParaSwapAggregator } from './para-swap/para-swap.aggregator';
import { ParaSwapModule } from './para-swap/para-swap.module';
import { ZeroXAggregator } from './zero-x/zero-x.aggregator';
import { ZeroXModule } from './zero-x/zero-x.module';

@Module({
  imports: [ZeroXModule, ParaSwapModule, OdosModule, JupiterModule],
  providers: [
    {
      provide: AGGREGATORS_TOKEN,
      useFactory: (
        zeroXAggregator: ZeroXAggregator,
        paraSwapAggregator: ParaSwapAggregator,
        odosAggregator: OdosAggregator,
        jupiterAggregator: JupiterAggregator,
      ) => [zeroXAggregator, paraSwapAggregator, odosAggregator, jupiterAggregator],
      inject: [ZeroXAggregator, ParaSwapAggregator, OdosAggregator, JupiterAggregator],
    },
  ],
  exports: [AGGREGATORS_TOKEN],
})
export class AggregatorsModule {}
