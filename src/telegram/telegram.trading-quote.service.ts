import { Inject, Injectable } from '@nestjs/common';
import type { Context } from 'telegraf';

import type { IPriceCommandDto } from './dto/price-command.dto';
import type { ISwapCommandDto } from './dto/swap-command.dto';
import { TelegramConnectionsService } from './telegram.connections.service';
import {
  buildPriceMessage,
  buildRouteBlockedMessage,
  buildRouteRiskWarningMessage,
  buildSwapQuotesMessage,
} from './telegram.message-formatters';
import { TelegramPortfolioService } from './telegram.portfolio.service';
import { formatSwapValidity } from './telegram.time';
import { TelegramTradeTemplatesService } from './telegram.trade-templates.service';
import { TelegramTradingButtonsService } from './telegram.trading-buttons.service';
import { TelegramTradingParserService } from './telegram.trading-parser.service';
import { PriceService } from '../price/price.service';
import { HighRiskRouteException } from '../route-safety/high-risk-route.exception';
import { RouteBlockedException } from '../route-safety/route-blocked.exception';
import { SwapService } from '../swap/swap.service';

@Injectable()
export class TelegramTradingQuoteService {
  @Inject()
  private readonly telegramTradingParserService!: TelegramTradingParserService;

  @Inject()
  private readonly telegramTemplatesService!: TelegramTradeTemplatesService;

  public constructor(
    private readonly priceService: PriceService,
    private readonly swapService: SwapService,
    private readonly portfolioService: TelegramPortfolioService,
    private readonly telegramTradingButtonsService: TelegramTradingButtonsService,
  ) {}

  public async handlePrice(
    context: Context,
    userId: string,
    text: string,
    command: IPriceCommandDto,
  ): Promise<void> {
    const result = await this.priceService.getBestQuote({
      chain: command.chain,
      userId,
      amount: command.amount,
      fromTokenInput: command.fromTokenInput,
      toTokenInput: command.toTokenInput,
      rawCommand: text,
      explicitChain: command.explicitChain,
    });

    const favoriteButtons = this.portfolioService.buildFavoriteActionButtons({
      chain: result.chain,
      amount: result.fromAmount,
      fromTokenAddress: result.fromTokenAddress,
      toTokenAddress: result.toTokenAddress,
      userId,
    });

    const presetButton = [
      [
        {
          text: '📋 Сохранить как пресет',
          callback_data: this.telegramTradingParserService.buildPresetSaveCallbackData({
            chain: result.chain,
            amount: result.fromAmount,
            fromTokenAddress: result.fromTokenAddress,
            toTokenAddress: result.toTokenAddress,
          }),
        },
      ],
    ];

    await context.reply(buildPriceMessage(result), {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [...presetButton, ...favoriteButtons] },
    });
  }

  public async handleSwap(
    context: Context,
    userId: string,
    text: string,
    command: ISwapCommandDto,
  ): Promise<void> {
    const quotes = await this.swapService.getSwapQuotes({
      chain: command.chain,
      userId,
      amount: command.amount,
      fromTokenInput: command.fromTokenInput,
      toTokenInput: command.toTokenInput,
      rawCommand: text,
      explicitChain: command.explicitChain,
    });

    const presetButton = [
      [
        {
          text: '📋 Сохранить как пресет',
          callback_data: this.telegramTradingParserService.buildPresetSaveCallbackData({
            chain: quotes.chain,
            amount: quotes.fromAmount,
            fromTokenAddress: quotes.fromTokenAddress,
            toTokenAddress: quotes.toTokenAddress,
          }),
        },
      ],
    ];

    await context.reply(buildSwapQuotesMessage(quotes, formatSwapValidity(quotes.quoteExpiresAt)), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          ...this.telegramTradingButtonsService.buildSwapButtons(
            quotes.providerQuotes,
            quotes.toSymbol,
            quotes.aggregator,
          ),
          ...presetButton,
          ...this.portfolioService.buildFavoriteActionButtons({
            chain: quotes.chain,
            amount: quotes.fromAmount,
            fromTokenAddress: quotes.fromTokenAddress,
            toTokenAddress: quotes.toTokenAddress,
            userId,
          }),
        ],
      },
    });
  }

  public async handleSwapCallback(
    context: Context,
    userId: string,
    selectionToken: string,
    connectionsService: TelegramConnectionsService,
  ): Promise<void> {
    await context.answerCbQuery('Подготовка свопа...');

    try {
      const session = await this.swapService.createSwapSessionFromSelection(userId, selectionToken);
      await connectionsService.replySwapSession(context, session);
    } catch (error) {
      if (error instanceof RouteBlockedException) {
        await context.reply(buildRouteBlockedMessage(error.assessment), { parse_mode: 'HTML' });
        return;
      }

      if (error instanceof HighRiskRouteException) {
        await context.reply(buildRouteRiskWarningMessage(error.assessment), {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '⚠️ Подтвердить',
                  callback_data: this.telegramTradingParserService.buildRiskConfirmCallbackData(
                    error.confirmToken,
                  ),
                },
                { text: '❌ Отменить', callback_data: 'rsk:cancel' },
              ],
            ],
          },
        });
        return;
      }

      throw error;
    }
  }

  public async handleRiskConfirmCallback(
    context: Context,
    userId: string,
    confirmToken: string,
    connectionsService: TelegramConnectionsService,
  ): Promise<void> {
    await context.answerCbQuery('Подготовка свопа...');
    const session = await this.swapService.confirmRiskySwap(userId, confirmToken);
    await connectionsService.replySwapSession(context, session);
  }
}
