import { Module } from '@nestjs/common';

import { WalletConnectService } from './wallet-connect.service';
import { WalletConnectSessionStore } from './wallet-connect.session-store';
import { AggregatorsModule } from '../aggregators/aggregators.module';

@Module({
  imports: [AggregatorsModule],
  providers: [WalletConnectSessionStore, WalletConnectService],
  exports: [WalletConnectService],
})
export class WalletConnectModule {}
