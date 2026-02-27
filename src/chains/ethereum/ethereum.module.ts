import { Module } from '@nestjs/common';

import { EthereumChain } from './ethereum.chain';

@Module({
  providers: [EthereumChain],
  exports: [EthereumChain],
})
export class EthereumModule {}
