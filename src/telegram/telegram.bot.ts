import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Context, Telegraf } from 'telegraf';

import { TelegramUpdateHandler } from './telegram.update-handler';

@Injectable()
export class TelegramBot implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBot.name);
  private bot: Telegraf | null = null;

  public constructor(
    private readonly configService: ConfigService,
    private readonly updateHandler: TelegramUpdateHandler,
  ) {}

  public async onModuleInit(): Promise<void> {
    if (!this.isTelegramEnabled()) {
      this.logger.log('Telegram bot is disabled by configuration');
      return;
    }

    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN') ?? '';

    if (token.trim() === '') {
      throw new Error('TELEGRAM_BOT_TOKEN is required when TELEGRAM_ENABLED=true');
    }

    this.bot = new Telegraf<Context>(token);
    this.updateHandler.register(this.bot);

    this.bot.catch(async (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Telegram update error: ${message}`);
    });

    const botInfo = await this.bot.telegram.getMe();
    this.logger.log(`Telegram bot authenticated: @${botInfo.username}`);

    void this.bot
      .launch({
        dropPendingUpdates: true,
      })
      .then(() => {
        this.logger.log('Telegram bot started');
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Telegram bot failed to launch: ${message}`);
      });
  }

  public async onModuleDestroy(): Promise<void> {
    if (!this.bot) {
      return;
    }

    this.bot.stop('application shutdown');
    this.logger.log('Telegram bot stopped');
  }

  private isTelegramEnabled(): boolean {
    const value = this.configService.get<string>('TELEGRAM_ENABLED') ?? 'false';
    return value.toLowerCase() === 'true';
  }
}
