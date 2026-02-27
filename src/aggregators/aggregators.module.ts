import { Module } from '@nestjs/common';

import { AGGREGATORS_TOKEN } from './aggregators.constants';
import { OdosAggregator } from './odos/odos.aggregator';
import { OdosModule } from './odos/odos.module';
import { ParaSwapAggregator } from './para-swap/para-swap.aggregator';
import { ParaSwapModule } from './para-swap/para-swap.module';
import { ZeroXAggregator } from './zero-x/zero-x.aggregator';
import { ZeroXModule } from './zero-x/zero-x.module';

@Module({
  imports: [ZeroXModule, ParaSwapModule, OdosModule],
  providers: [
    {
      provide: AGGREGATORS_TOKEN,
      useFactory: (
        zeroXAggregator: ZeroXAggregator,
        paraSwapAggregator: ParaSwapAggregator,
        odosAggregator: OdosAggregator,
      ) => [zeroXAggregator, paraSwapAggregator, odosAggregator],
      inject: [ZeroXAggregator, ParaSwapAggregator, OdosAggregator],
    },
  ],
  exports: [AGGREGATORS_TOKEN],
})
export class AggregatorsModule {}
