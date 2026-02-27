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
import { SolanaChain } from './solana/solana.chain';
import { SolanaModule } from './solana/solana.module';

@Module({
  imports: [EthereumModule, ArbitrumModule, BaseModule, OptimismModule, SolanaModule],
  providers: [
    {
      provide: CHAINS_TOKEN,
      useFactory: (
        ...chains: [EthereumChain, ArbitrumChain, BaseChain, OptimismChain, SolanaChain]
      ) => chains,
      inject: [EthereumChain, ArbitrumChain, BaseChain, OptimismChain, SolanaChain],
    },
  ],
  exports: [CHAINS_TOKEN, EthereumModule, ArbitrumModule, BaseModule, OptimismModule, SolanaModule],
})
export class ChainsModule {}
