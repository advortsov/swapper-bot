import { Module } from '@nestjs/common';

import { OptimismChain } from './optimism.chain';

@Module({
  providers: [OptimismChain],
  exports: [OptimismChain],
})
export class OptimismModule {}
