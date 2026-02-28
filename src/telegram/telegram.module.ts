import { Module } from '@nestjs/common';

import { TelegramBot } from './telegram.bot';
import { TelegramSettingsHandler } from './telegram.settings-handler';
import { TelegramUpdateHandler } from './telegram.update-handler';
import { PriceModule } from '../price/price.module';
import { SettingsModule } from '../settings/settings.module';
import { SwapModule } from '../swap/swap.module';

@Module({
  imports: [PriceModule, SwapModule, SettingsModule],
  providers: [TelegramSettingsHandler, TelegramUpdateHandler, TelegramBot],
})
export class TelegramModule {}
