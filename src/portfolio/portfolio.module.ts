import { Global, Module } from '@nestjs/common';

import { PortfolioService } from './portfolio.service';
import { TokenBalanceReaderService } from './token-balance-reader.service';

@Global()
@Module({
  providers: [TokenBalanceReaderService, PortfolioService],
  exports: [TokenBalanceReaderService, PortfolioService],
})
export class PortfolioModule {}
