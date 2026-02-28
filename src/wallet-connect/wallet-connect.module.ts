import { Module } from '@nestjs/common';

import { WalletConnectController } from './wallet-connect.controller';
import { WalletConnectPhantomService } from './wallet-connect.phantom.service';
import { WalletConnectService } from './wallet-connect.service';
import { WalletConnectSessionStore } from './wallet-connect.session-store';
import { AggregatorsModule } from '../aggregators/aggregators.module';
import { ChainsModule } from '../chains/chains.module';

@Module({
  imports: [AggregatorsModule, ChainsModule],
  controllers: [WalletConnectController],
  providers: [WalletConnectSessionStore, WalletConnectPhantomService, WalletConnectService],
  exports: [WalletConnectService],
})
export class WalletConnectModule {}
