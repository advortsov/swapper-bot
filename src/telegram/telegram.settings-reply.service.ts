import { Injectable } from '@nestjs/common';
import type { Context } from 'telegraf';

import { buildCustomSlippagePrompt, buildErrorMessage } from './telegram.message-formatters';
import {
  MAX_CUSTOM_SLIPPAGE,
  MIN_CUSTOM_SLIPPAGE,
  TelegramSettingsMenuService,
} from './telegram.settings-menu.service';
import type { IUserSettings } from '../settings/interfaces/user-settings.interface';

@Injectable()
export class TelegramSettingsReplyService {
  public constructor(private readonly menuService: TelegramSettingsMenuService) {}

  public async replyMainMenu(context: Context, settings: IUserSettings): Promise<void> {
    await context.reply(this.menuService.buildMainMenuText(settings), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: this.menuService.buildMainMenuKeyboard(),
      },
    });
  }

  public async editMainMenu(context: Context, settings: IUserSettings): Promise<void> {
    await context.editMessageText(this.menuService.buildMainMenuText(settings), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: this.menuService.buildMainMenuKeyboard(),
      },
    });
  }

  public async editSlippageMenu(context: Context): Promise<void> {
    const menu = this.menuService.buildSlippageMenu();

    await context.editMessageText(menu.text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: menu.inlineKeyboard,
      },
    });
  }

  public async editAggregatorMenu(context: Context, settings: IUserSettings): Promise<void> {
    const menu = this.menuService.buildAggregatorMenu(settings);

    await context.editMessageText(menu.text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: menu.inlineKeyboard,
      },
    });
  }

  public async editCustomSlippagePrompt(context: Context): Promise<void> {
    await context.editMessageText(
      buildCustomSlippagePrompt(MIN_CUSTOM_SLIPPAGE, MAX_CUSTOM_SLIPPAGE),
      {
        parse_mode: 'HTML',
      },
    );
  }

  public async replyError(context: Context, message: string): Promise<void> {
    await context.reply(buildErrorMessage(message), {
      parse_mode: 'HTML',
    });
  }
}
