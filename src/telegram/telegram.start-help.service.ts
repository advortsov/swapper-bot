import { Injectable } from '@nestjs/common';
import type { Context } from 'telegraf';

import { buildHelpMessage, buildStartMessage } from './telegram.message-formatters';

@Injectable()
export class TelegramStartHelpService {
  public async handleStart(context: Context): Promise<void> {
    await context.reply(buildStartMessage(), { parse_mode: 'HTML' });
  }

  public async handleHelp(context: Context): Promise<void> {
    await context.reply(buildHelpMessage(), { parse_mode: 'HTML' });
  }
}
