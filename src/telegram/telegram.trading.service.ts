import { Injectable, Logger } from '@nestjs/common';
import type { Context } from 'telegraf';

import type { IPriceCommandDto } from './dto/price-command.dto';
import type { ISwapCommandDto } from './dto/swap-command.dto';
import { TelegramConnectionsService } from './telegram.connections.service';
import { TelegramPortfolioService } from './telegram.portfolio.service';
import type { ChainType } from '../chains/interfaces/chain.interface';
import { DEFAULT_CHAIN, SUPPORTED_CHAINS } from '../chains/interfaces/chain.interface';
import { BusinessException } from '../common/exceptions/business.exception';
import { UsersRepository } from '../database/repositories/users.repository';
import type { IProviderQuote } from '../price/interfaces/price.interface';
import { PriceService } from '../price/price.service';
import { SwapService } from '../swap/swap.service';

const PRICE_COMMAND_REGEX =
  /^\/price\s+([0-9]*\.?[0-9]+)\s+([a-zA-Z0-9]+)\s+to\s+([a-zA-Z0-9]+)(?:\s+on\s+([a-zA-Z0-9_-]+))?$/i;
const SWAP_COMMAND_REGEX =
  /^\/swap\s+([0-9]*\.?[0-9]+)\s+([a-zA-Z0-9]+)\s+to\s+([a-zA-Z0-9]+)(?:\s+on\s+([a-zA-Z0-9_-]+))?$/i;
const SUPPORTED_CHAIN_SET = new Set<ChainType>(SUPPORTED_CHAINS);
const GAS_USD_PRECISION = 4;
const AMOUNT_MATCH_INDEX = 1;
const FROM_SYMBOL_MATCH_INDEX = 2;
const TO_SYMBOL_MATCH_INDEX = 3;
const CHAIN_MATCH_INDEX = 4;
const SWAP_CALLBACK_PREFIX = 'sw:';

@Injectable()
export class TelegramTradingService {
  private readonly logger = new Logger(TelegramTradingService.name);

  public constructor(
    private readonly priceService: PriceService,
    private readonly swapService: SwapService,
    private readonly usersRepository: UsersRepository,
    private readonly portfolioService: TelegramPortfolioService,
  ) {}

  public async handlePrice(
    context: Context,
    userId: string,
    username: string | null,
    text: string,
  ): Promise<void> {
    const command = this.parsePriceCommand(text);
    await this.upsertUser(userId, username);

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

    await context.reply(this.buildPriceMessage(result), {
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  public async handleSwap(
    context: Context,
    userId: string,
    username: string | null,
    text: string,
  ): Promise<void> {
    const command = this.parseSwapCommand(text);
    await this.upsertUser(userId, username);

    const quotes = await this.swapService.getSwapQuotes({
      chain: command.chain,
      userId,
      amount: command.amount,
      fromTokenInput: command.fromTokenInput,
      toTokenInput: command.toTokenInput,
      rawCommand: text,
      explicitChain: command.explicitChain,
    });

    await context.reply(this.buildSwapQuotesMessage(quotes), {
      reply_markup: {
        inline_keyboard: [
          ...this.buildSwapButtons(quotes.providerQuotes, quotes.toSymbol, quotes.aggregator),
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
    data: string,
    connectionsService: TelegramConnectionsService,
  ): Promise<void> {
    const selectionToken = data.slice(SWAP_CALLBACK_PREFIX.length);

    if (selectionToken.trim() === '') {
      await context.answerCbQuery('Неверные данные');
      return;
    }

    await context.answerCbQuery('Подготовка свопа...');
    const session = await this.swapService.createSwapSessionFromSelection(userId, selectionToken);
    await connectionsService.replySwapSession(context, session);
  }

  public isSwapCallback(data: string): boolean {
    return data.startsWith(SWAP_CALLBACK_PREFIX);
  }

  private buildPriceMessage(result: Awaited<ReturnType<PriceService['getBestQuote']>>): string {
    const gasText =
      result.estimatedGasUsd === null
        ? 'N/A'
        : `$${result.estimatedGasUsd.toFixed(GAS_USD_PRECISION)}`;
    const providerQuoteLines = result.providerQuotes.flatMap((quote) =>
      this.buildQuoteLines(quote, result.toSymbol),
    );

    return [
      `Лучший курс для ${result.fromAmount} ${result.fromSymbol} -> ${result.toAmount} ${result.toSymbol}`,
      `Сеть: ${result.chain}`,
      `Агрегатор: ${result.aggregator}`,
      `Gross: ${result.grossToAmount} ${result.toSymbol}`,
      `Комиссия бота: ${result.feeAmount} ${result.feeAmountSymbol ?? result.toSymbol} (${result.feeBps} bps, ${result.feeDisplayLabel})`,
      `Net: ${result.toAmount} ${result.toSymbol}`,
      `Оценка газа в USD: ${gasText}`,
      `Провайдеров опрошено: ${result.providersPolled}`,
      'Котировки провайдеров:',
      ...providerQuoteLines,
    ].join('\n');
  }

  private buildSwapQuotesMessage(
    quotes: Awaited<ReturnType<SwapService['getSwapQuotes']>>,
  ): string {
    const providerQuoteLines = quotes.providerQuotes.flatMap((quote) =>
      this.buildQuoteLines(quote, quotes.toSymbol),
    );

    return [
      `Котировки для ${quotes.fromAmount} ${quotes.fromSymbol} -> ${quotes.toAmount} ${quotes.toSymbol}`,
      `Сеть: ${quotes.chain}`,
      `Лучший агрегатор: ${quotes.aggregator}`,
      `Gross: ${quotes.grossToAmount} ${quotes.toSymbol}`,
      `Комиссия бота: ${quotes.feeAmount} ${quotes.feeAmountSymbol ?? quotes.toSymbol} (${quotes.feeBps} bps, ${quotes.feeDisplayLabel})`,
      `Net: ${quotes.toAmount} ${quotes.toSymbol}`,
      `Срок актуальности свопа: ${quotes.quoteExpiresAt}`,
      `Котировка актуальна до: ${quotes.quoteExpiresAt}`,
      `Провайдеров опрошено: ${quotes.providersPolled}`,
      'Итоговая транзакция будет собрана уже с учётом комиссии бота.',
      '',
      'Доступные котировки:',
      ...providerQuoteLines,
      '',
      'Выбери агрегатор для свопа:',
    ].join('\n');
  }

  private buildSwapButtons(
    providerQuotes: readonly IProviderQuote[],
    toSymbol: string,
    bestAggregator: string,
  ): { text: string; callback_data: string }[][] {
    return providerQuotes.flatMap((quote) => {
      if (!quote.selectionToken) {
        return [];
      }

      const prefix = quote.aggregator === bestAggregator ? '\u2B50 ' : '';
      const feeText =
        quote.feeAmount === '0'
          ? 'no fee'
          : `${quote.feeDisplayLabel}: ${quote.feeAmount} ${quote.feeAmountSymbol ?? toSymbol}`;

      return [
        [
          {
            text: `${prefix}${quote.aggregator}: ${quote.toAmount} ${toSymbol} • ${feeText}`,
            callback_data: `${SWAP_CALLBACK_PREFIX}${quote.selectionToken}`,
          },
        ],
      ];
    });
  }

  private buildQuoteLines(quote: IProviderQuote, toSymbol: string): readonly string[] {
    const gasText =
      quote.estimatedGasUsd === null
        ? 'N/A'
        : `$${quote.estimatedGasUsd.toFixed(GAS_USD_PRECISION)}`;

    return [
      `- ${quote.aggregator}: gross ${quote.grossToAmount} ${toSymbol}, fee ${quote.feeAmount} ${quote.feeAmountSymbol ?? toSymbol} (${quote.feeDisplayLabel}), net ${quote.toAmount} ${toSymbol}, gas ${gasText}`,
    ];
  }

  private parsePriceCommand(text: string): IPriceCommandDto {
    const matches = PRICE_COMMAND_REGEX.exec(text);

    if (!matches) {
      throw new BusinessException(
        'Команда не распознана. Пример: /price 10 USDC to USDT on ethereum',
      );
    }

    return {
      amount: this.getMatch(matches, AMOUNT_MATCH_INDEX),
      fromTokenInput: this.getMatch(matches, FROM_SYMBOL_MATCH_INDEX),
      toTokenInput: this.getMatch(matches, TO_SYMBOL_MATCH_INDEX),
      chain: this.resolveChain(matches[CHAIN_MATCH_INDEX]),
      explicitChain: Boolean(matches[CHAIN_MATCH_INDEX]),
    };
  }

  private parseSwapCommand(text: string): ISwapCommandDto {
    const matches = SWAP_COMMAND_REGEX.exec(text);

    if (!matches) {
      throw new BusinessException(
        'Команда не распознана. Пример: /swap 10 USDC to USDT on ethereum',
      );
    }

    return {
      amount: this.getMatch(matches, AMOUNT_MATCH_INDEX),
      fromTokenInput: this.getMatch(matches, FROM_SYMBOL_MATCH_INDEX),
      toTokenInput: this.getMatch(matches, TO_SYMBOL_MATCH_INDEX),
      chain: this.resolveChain(matches[CHAIN_MATCH_INDEX]),
      explicitChain: Boolean(matches[CHAIN_MATCH_INDEX]),
    };
  }

  private getMatch(matches: RegExpExecArray, index: number): string {
    const value = matches[index];

    if (!value) {
      throw new BusinessException('Команда не распознана');
    }

    return value.trim();
  }

  private resolveChain(rawValue: string | undefined): ChainType {
    if (!rawValue) {
      return DEFAULT_CHAIN;
    }

    const chain = rawValue.toLowerCase() as ChainType;

    if (!SUPPORTED_CHAIN_SET.has(chain)) {
      throw new BusinessException(
        `Сеть ${rawValue} не поддерживается. Доступно: ${SUPPORTED_CHAINS.join(', ')}`,
      );
    }

    return chain;
  }

  private async upsertUser(userId: string, username: string | null): Promise<void> {
    await this.usersRepository.upsertUser({ id: userId, username });
  }
}
