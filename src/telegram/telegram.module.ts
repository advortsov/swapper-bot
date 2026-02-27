import { Module } from '@nestjs/common';

import { TelegramBot } from './telegram.bot';
import { TelegramUpdateHandler } from './telegram.update-handler';
import { PriceModule } from '../price/price.module';
import { SwapModule } from '../swap/swap.module';

@Module({
  imports: [PriceModule, SwapModule],
  providers: [TelegramUpdateHandler, TelegramBot],
})
export class TelegramModule {}
