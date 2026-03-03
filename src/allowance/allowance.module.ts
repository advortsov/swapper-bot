import { Module, forwardRef } from '@nestjs/common';

import { AllowanceService } from './allowance.service';
import { AggregatorsModule } from '../aggregators/aggregators.module';
import { TokenResolutionModule } from '../token-resolution/token-resolution.module';
import { TokensModule } from '../tokens/tokens.module';
import { WalletConnectModule } from '../wallet-connect/wallet-connect.module';

@Module({
  imports: [
    AggregatorsModule,
    TokenResolutionModule,
    TokensModule,
    forwardRef(() => WalletConnectModule),
  ],
  providers: [AllowanceService],
  exports: [AllowanceService],
})
export class AllowanceModule {}
