import { Injectable } from '@nestjs/common';
import type { Context, Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';

import { TelegramCallbackRouterService } from './telegram.callback-router.service';
import { TelegramCommandRouterService } from './telegram.command-router.service';
import { TelegramSettingsHandler } from './telegram.settings-handler';
import { TelegramTradeTemplatesService } from './telegram.trade-templates.service';
import { TelegramStartHelpService } from './telegram.start-help.service';

@Injectable()
export class TelegramUpdateHandler {
  public constructor(
    private readonly settingsHandler: TelegramSettingsHandler,
    private readonly commandRouter: TelegramCommandRouterService,
    private readonly callbackRouter: TelegramCallbackRouterService,
    private readonly templatesService: TelegramTradeTemplatesService,
    private readonly startHelpService: TelegramStartHelpService,
  ) {}

  public register(bot: Telegraf): void {
    bot.command('start', async (context: Context) => this.startHelpService.handleStart(context));
    bot.command('help', async (context: Context) => this.startHelpService.handleHelp(context));
    bot.command('price', async (context: Context) => this.commandRouter.handlePrice(context));
    bot.command('swap', async (context: Context) => this.commandRouter.handleSwap(context));
    bot.command('approve', async (context: Context) => this.commandRouter.handleApprove(context));
    bot.command('connect', async (context: Context) => this.commandRouter.handleConnect(context));
    bot.command('disconnect', async (context: Context) =>
      this.commandRouter.handleDisconnect(context),
    );
    bot.command('favorites', async (context: Context) =>
      this.commandRouter.handleFavorites(context),
    );
    bot.command('history', async (context: Context) => this.commandRouter.handleHistory(context));
    bot.command('tx', async (context: Context) => this.commandRouter.handleTx(context));
    bot.command('portfolio', async (context: Context) => this.commandRouter.handlePortfolio(context));
    bot.command('templates', async (context: Context) => this.commandRouter.handleTemplates(context));
    this.settingsHandler.register(bot);
    bot.action(/.*/, async (context: Context) => this.callbackRouter.handleAction(context));
    bot.on(message('text'), async (context: Context) => this.commandRouter.handleText(context));
  }
}
