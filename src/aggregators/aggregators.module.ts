import { Module } from '@nestjs/common';

import { AGGREGATORS_TOKEN } from './aggregators.constants';
import { ZeroXAggregator } from './zero-x/zero-x.aggregator';
import { ZeroXModule } from './zero-x/zero-x.module';

@Module({
  imports: [ZeroXModule],
  providers: [
    {
      provide: AGGREGATORS_TOKEN,
      useFactory: (zeroXAggregator: ZeroXAggregator) => [zeroXAggregator],
      inject: [ZeroXAggregator],
    },
  ],
  exports: [AGGREGATORS_TOKEN],
})
export class AggregatorsModule {}
