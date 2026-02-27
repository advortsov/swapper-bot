import { Module } from '@nestjs/common';

import { EthereumModule } from './ethereum/ethereum.module';

@Module({
  imports: [EthereumModule],
  exports: [EthereumModule],
})
export class ChainsModule {}
