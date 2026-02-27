import { Module } from '@nestjs/common';

import { JupiterAggregator } from './jupiter.aggregator';

@Module({
  providers: [JupiterAggregator],
  exports: [JupiterAggregator],
})
export class JupiterModule {}
