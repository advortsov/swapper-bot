import { Module } from '@nestjs/common';

import { ArbitrumChain } from './arbitrum/arbitrum.chain';
import { ArbitrumModule } from './arbitrum/arbitrum.module';
import { BaseChain } from './base/base.chain';
import { BaseModule } from './base/base.module';
import { CHAINS_TOKEN } from './chains.constants';
import { EthereumChain } from './ethereum/ethereum.chain';
import { EthereumModule } from './ethereum/ethereum.module';
import { OptimismChain } from './optimism/optimism.chain';
import { OptimismModule } from './optimism/optimism.module';

@Module({
  imports: [EthereumModule, ArbitrumModule, BaseModule, OptimismModule],
  providers: [
    {
      provide: CHAINS_TOKEN,
      useFactory: (
        ethereumChain: EthereumChain,
        arbitrumChain: ArbitrumChain,
        baseChain: BaseChain,
        optimismChain: OptimismChain,
      ) => [ethereumChain, arbitrumChain, baseChain, optimismChain],
      inject: [EthereumChain, ArbitrumChain, BaseChain, OptimismChain],
    },
  ],
  exports: [CHAINS_TOKEN, EthereumModule, ArbitrumModule, BaseModule, OptimismModule],
})
export class ChainsModule {}
