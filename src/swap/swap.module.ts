import { Module } from '@nestjs/common';

import { SwapService } from './swap.service';
import { PriceModule } from '../price/price.module';
import { SettingsModule } from '../settings/settings.module';
import { WalletConnectModule } from '../wallet-connect/wallet-connect.module';

@Module({
  imports: [PriceModule, WalletConnectModule, SettingsModule],
  providers: [SwapService],
  exports: [SwapService],
})
export class SwapModule {}
