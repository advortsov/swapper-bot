import { Global, Module } from '@nestjs/common';

import { TokenBalanceReaderService } from './token-balance-reader.service';
import { PortfolioService } from './portfolio.service';

@Global()
@Module({
  providers: [TokenBalanceReaderService, PortfolioService],
  exports: [TokenBalanceReaderService, PortfolioService],
})
export class PortfolioModule {}
