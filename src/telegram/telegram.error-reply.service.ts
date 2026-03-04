import { Injectable, Logger } from '@nestjs/common';
import type { Context } from 'telegraf';

import { buildErrorMessage } from './telegram.message-formatters';

@Injectable()
export class TelegramErrorReplyService {
  private readonly logger = new Logger(TelegramErrorReplyService.name);

  public async replyWithError(context: Context, prefix: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`${prefix}: ${message}`);
    await context.reply(buildErrorMessage(message), { parse_mode: 'HTML' });
  }
}
