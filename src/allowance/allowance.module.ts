import { Module, forwardRef } from '@nestjs/common';

import { AllowanceActionService } from './allowance-action.service';
import { AllowanceContextService } from './allowance-context.service';
import { AllowanceGuardService } from './allowance-guard.service';
import { AllowanceReaderService } from './allowance-reader.service';
import { AllowanceTargetService } from './allowance-target.service';
import { AllowanceTransactionService } from './allowance-transaction.service';
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
  providers: [
    AllowanceActionService,
    AllowanceContextService,
    AllowanceGuardService,
    AllowanceReaderService,
    AllowanceService,
    AllowanceTargetService,
    AllowanceTransactionService,
  ],
  exports: [AllowanceService],
})
export class AllowanceModule {}
