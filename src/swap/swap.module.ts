import { Module, forwardRef } from '@nestjs/common';

import { SwapExecutionAuditService } from './swap-execution-audit.service';
import { SwapIntentService } from './swap-intent.service';
import { SwapService } from './swap.service';
import { PriceModule } from '../price/price.module';
import { SettingsModule } from '../settings/settings.module';
import { WalletConnectModule } from '../wallet-connect/wallet-connect.module';

@Module({
  imports: [PriceModule, forwardRef(() => WalletConnectModule), SettingsModule],
  providers: [SwapService, SwapIntentService, SwapExecutionAuditService],
  exports: [SwapService, SwapIntentService, SwapExecutionAuditService],
})
export class SwapModule {}
