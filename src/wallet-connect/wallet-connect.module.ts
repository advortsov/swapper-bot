import { Module, forwardRef } from '@nestjs/common';

import { WalletConnectApprovalRegistry } from './wallet-connect.approval-registry';
import { WalletConnectApprovedSessionService } from './wallet-connect.approved-session.service';
import { WalletConnectClientService } from './wallet-connect.client.service';
import { WalletConnectConnectedWalletService } from './wallet-connect.connected-wallet.service';
import { WalletConnectConnectionService } from './wallet-connect.connection.service';
import { WalletConnectController } from './wallet-connect.controller';
import { WalletConnectLifecycleService } from './wallet-connect.lifecycle.service';
import { WalletConnectPhantomLinksService } from './wallet-connect.phantom-links.service';
import { WalletConnectPhantomMessagingService } from './wallet-connect.phantom-messaging.service';
import { WalletConnectPhantomStateService } from './wallet-connect.phantom-state.service';
import { WalletConnectPhantomTransactionService } from './wallet-connect.phantom-transaction.service';
import { WalletConnectPhantomService } from './wallet-connect.phantom.service';
import { WalletConnectService } from './wallet-connect.service';
import { WalletConnectSessionOrchestrator } from './wallet-connect.session-orchestrator';
import { WalletConnectSessionStore } from './wallet-connect.session-store';
import { AggregatorsModule } from '../aggregators/aggregators.module';
import { AllowanceModule } from '../allowance/allowance.module';
import { ChainsModule } from '../chains/chains.module';
import { SwapModule } from '../swap/swap.module';

@Module({
  imports: [
    AggregatorsModule,
    ChainsModule,
    forwardRef(() => AllowanceModule),
    forwardRef(() => SwapModule),
  ],
  controllers: [WalletConnectController],
  providers: [
    WalletConnectApprovalRegistry,
    WalletConnectApprovedSessionService,
    WalletConnectClientService,
    WalletConnectConnectedWalletService,
    WalletConnectConnectionService,
    WalletConnectLifecycleService,
    WalletConnectPhantomLinksService,
    WalletConnectPhantomMessagingService,
    WalletConnectPhantomService,
    WalletConnectPhantomStateService,
    WalletConnectPhantomTransactionService,
    WalletConnectService,
    WalletConnectSessionOrchestrator,
    WalletConnectSessionStore,
  ],
  exports: [WalletConnectService, WalletConnectSessionStore],
})
export class WalletConnectModule {}
