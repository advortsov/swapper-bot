import { Injectable } from '@nestjs/common';
import type { Context } from 'telegraf';

import { TelegramErrorReplyService } from './telegram.error-reply.service';
import { buildPortfolioMessage } from './telegram.message-formatters';
import { PortfolioService } from '../portfolio/portfolio.service';

@Injectable()
export class TelegramPortfolioBalanceService {
  public constructor(
    private readonly portfolioService: PortfolioService,
    private readonly errorReplyService: TelegramErrorReplyService,
  ) {}

  public async handlePortfolio(context: Context, userId: string): Promise<void> {
    try {
      const summary = await this.portfolioService.getUserPortfolio(userId);

      if (summary.assets.length === 0) {
        await context.reply(
          '💼 <b>Портфель пуст</b>\n\nСначала подключи кошелёк командой /connect.',
          { parse_mode: 'HTML' },
        );
        return;
      }

      await context.reply(buildPortfolioMessage(summary), { parse_mode: 'HTML' });
    } catch (error: unknown) {
      await this.errorReplyService.replyWithError(context, 'Portfolio command failed', error);
    }
  }
}
