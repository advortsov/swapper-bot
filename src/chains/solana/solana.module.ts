import { Module } from '@nestjs/common';

import { SolanaChain } from './solana.chain';

@Module({
  providers: [SolanaChain],
  exports: [SolanaChain],
})
export class SolanaModule {}
