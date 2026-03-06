import { Module, forwardRef } from '@nestjs/common';

import { SwapExecutionAuditService } from './swap-execution-audit.service';
import { SwapIntentService } from './swap-intent.service';
import { SwapExpirationService } from './swap.expiration.service';
import { SwapQuotesService } from './swap.quotes.service';
import { SwapSelectionService } from './swap.selection.service';
import { SwapService } from './swap.service';
import { SwapSessionService } from './swap.session.service';
import { PriceModule } from '../price/price.module';
import { RouteSafetyModule } from '../route-safety/route-safety.module';
import { SettingsModule } from '../settings/settings.module';
import { WalletConnectModule } from '../wallet-connect/wallet-connect.module';

@Module({
  imports: [PriceModule, forwardRef(() => WalletConnectModule), SettingsModule, RouteSafetyModule],
  providers: [
    SwapExpirationService,
    SwapQuotesService,
    SwapSelectionService,
    SwapSessionService,
    SwapService,
    SwapIntentService,
    SwapExecutionAuditService,
  ],
  exports: [SwapService, SwapIntentService, SwapExecutionAuditService],
})
export class SwapModule {}
