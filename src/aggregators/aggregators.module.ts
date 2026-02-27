import { Module } from '@nestjs/common';

import { AGGREGATORS_TOKEN } from './aggregators.constants';
import { ParaSwapAggregator } from './para-swap/para-swap.aggregator';
import { ParaSwapModule } from './para-swap/para-swap.module';
import { ZeroXAggregator } from './zero-x/zero-x.aggregator';
import { ZeroXModule } from './zero-x/zero-x.module';

@Module({
  imports: [ZeroXModule, ParaSwapModule],
  providers: [
    {
      provide: AGGREGATORS_TOKEN,
      useFactory: (zeroXAggregator: ZeroXAggregator, paraSwapAggregator: ParaSwapAggregator) => [
        zeroXAggregator,
        paraSwapAggregator,
      ],
      inject: [ZeroXAggregator, ParaSwapAggregator],
    },
  ],
  exports: [AGGREGATORS_TOKEN],
})
export class AggregatorsModule {}
