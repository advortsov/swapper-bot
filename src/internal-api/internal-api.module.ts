import { Module } from '@nestjs/common';

import { InternalApiController } from './internal-api.controller';
import { InternalApiGuard } from './internal-api.guard';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { PriceModule } from '../price/price.module';
import { SwapModule } from '../swap/swap.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { WalletConnectModule } from '../wallet-connect/wallet-connect.module';

@Module({
  imports: [PriceModule, SwapModule, WalletConnectModule, PortfolioModule, TransactionsModule],
  providers: [InternalApiGuard],
  controllers: [InternalApiController],
})
export class InternalApiModule {}
