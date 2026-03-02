import { Module } from '@nestjs/common';

import { CoinGeckoClient } from './coin-gecko.client';
import { TokenAddressResolverService } from './token-address-resolver.service';
import { ChainsModule } from '../chains/chains.module';
import { TokensModule } from '../tokens/tokens.module';

@Module({
  imports: [ChainsModule, TokensModule],
  providers: [CoinGeckoClient, TokenAddressResolverService],
  exports: [TokenAddressResolverService],
})
export class TokenResolutionModule {}
