import { Injectable } from '@nestjs/common';
import type { Context } from 'telegraf';

import { buildHistoryMessage } from './telegram.message-formatters';
import { SwapHistoryService } from '../history/swap-history.service';

@Injectable()
export class TelegramPortfolioHistoryService {
  public constructor(private readonly swapHistoryService: SwapHistoryService) {}

  public async handleHistory(context: Context, userId: string): Promise<void> {
    const items = await this.swapHistoryService.listRecent(userId);
    await context.reply(buildHistoryMessage(items), { parse_mode: 'HTML' });
  }
}
