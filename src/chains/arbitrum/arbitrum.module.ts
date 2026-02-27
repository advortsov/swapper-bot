import { Module } from '@nestjs/common';

import { ArbitrumChain } from './arbitrum.chain';

@Module({
  providers: [ArbitrumChain],
  exports: [ArbitrumChain],
})
export class ArbitrumModule {}
