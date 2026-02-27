import { Module } from '@nestjs/common';

import { TelegramBot } from './telegram.bot';
import { TelegramUpdateHandler } from './telegram.update-handler';
import { PriceModule } from '../price/price.module';

@Module({
  imports: [PriceModule],
  providers: [TelegramUpdateHandler, TelegramBot],
})
export class TelegramModule {}
