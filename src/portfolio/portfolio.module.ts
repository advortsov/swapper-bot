import { Module } from '@nestjs/common';

import { PortfolioService } from './portfolio.service';
import { TokenBalanceReaderService } from './token-balance-reader.service';
import { ChainsModule } from '../chains/chains.module';
import { TokensRepository } from '../tokens/tokens.repository';
import { WalletConnectModule } from '../wallet-connect/wallet-connect.module';

@Module({
  imports: [ChainsModule, WalletConnectModule],
  providers: [TokenBalanceReaderService, PortfolioService, TokensRepository],
  exports: [TokenBalanceReaderService, PortfolioService],
})
export class PortfolioModule {}
