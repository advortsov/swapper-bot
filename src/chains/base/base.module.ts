import { Module } from '@nestjs/common';

import { BaseChain } from './base.chain';

@Module({
  providers: [BaseChain],
  exports: [BaseChain],
})
export class BaseModule {}
