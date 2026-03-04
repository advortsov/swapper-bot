import { Injectable } from '@nestjs/common';
import type { Context } from 'telegraf';

import type { IPriceCommandDto } from './dto/price-command.dto';
import type { ISwapCommandDto } from './dto/swap-command.dto';
import { TelegramConnectionsService } from './telegram.connections.service';
import { buildPriceMessage, buildSwapQuotesMessage } from './telegram.message-formatters';
import { TelegramPortfolioService } from './telegram.portfolio.service';
import { formatSwapValidity } from './telegram.time';
import { TelegramTradingButtonsService } from './telegram.trading-buttons.service';
import { PriceService } from '../price/price.service';
import { SwapService } from '../swap/swap.service';

@Injectable()
export class TelegramTradingQuoteService {
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

    const keyboard = this.portfolioService.buildFavoriteActionButtons({
      chain: result.chain,
      amount: result.fromAmount,
      fromTokenAddress: result.fromTokenAddress,
      toTokenAddress: result.toTokenAddress,
      userId,
    });

    await context.reply(buildPriceMessage(result), {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard },
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

    await context.reply(buildSwapQuotesMessage(quotes, formatSwapValidity(quotes.quoteExpiresAt)), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          ...this.telegramTradingButtonsService.buildSwapButtons(
            quotes.providerQuotes,
            quotes.toSymbol,
            quotes.aggregator,
          ),
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
    const session = await this.swapService.createSwapSessionFromSelection(userId, selectionToken);
    await connectionsService.replySwapSession(context, session);
  }
}
