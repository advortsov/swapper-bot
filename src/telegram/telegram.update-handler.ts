import { Injectable, Logger } from '@nestjs/common';
import QRCode from 'qrcode';
import { Input, type Context, type Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import type { InlineKeyboardButton, Message } from 'telegraf/typings/core/types/typegram';

import type { IPriceCommandDto } from './dto/price-command.dto';
import type { ISwapCommandDto } from './dto/swap-command.dto';
import { TelegramSettingsHandler } from './telegram.settings-handler';
import { createDateTimeFormatter, formatLocalDateTime, formatSwapValidity } from './telegram.time';
import {
  DEFAULT_CHAIN,
  SUPPORTED_CHAINS,
  type ChainType,
} from '../chains/interfaces/chain.interface';
import { BusinessException } from '../common/exceptions/business.exception';
import { UsersRepository } from '../database/repositories/users.repository';
import type { IProviderQuote } from '../price/interfaces/price.interface';
import { PriceService } from '../price/price.service';
import type { ISwapSessionResponse } from '../swap/interfaces/swap.interface';
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
const QR_CODE_WIDTH = 512;
const QR_CODE_MARGIN = 2;

@Injectable()
export class TelegramUpdateHandler {
  private readonly logger = new Logger(TelegramUpdateHandler.name);
  private readonly dateTimeFormatter: Intl.DateTimeFormat;

  public constructor(
    private readonly priceService: PriceService,
    private readonly swapService: SwapService,
    private readonly usersRepository: UsersRepository,
    private readonly settingsHandler: TelegramSettingsHandler,
  ) {
    this.dateTimeFormatter = createDateTimeFormatter(process.env['APP_TIMEZONE']);
  }

  public register(bot: Telegraf): void {
    bot.command('start', async (context: Context) => this.handleStart(context));
    bot.command('price', async (context: Context) => this.handlePrice(context));
    bot.command('swap', async (context: Context) => this.handleSwap(context));
    this.settingsHandler.register(bot);
    bot.action(new RegExp(`^${SWAP_CALLBACK_PREFIX}`), async (context: Context) =>
      this.handleSwapCallback(context),
    );
    bot.on(message('text'), async (context: Context) => this.handleText(context));
  }

  private async handleText(context: Context): Promise<void> {
    const from = context.from;

    if (!from) {
      return;
    }

    const userId = from.id.toString();

    if (this.settingsHandler.hasPendingInput(userId)) {
      await this.settingsHandler.handleTextInput(context);
    }
  }

  private async handleStart(context: Context): Promise<void> {
    const from = context.from;

    if (!from) {
      return;
    }

    await this.usersRepository.upsertUser({
      id: from.id.toString(),
      username: from.username ?? null,
    });

    await context.reply(
      [
        'Привет! Команды:',
        '/price <amount> <from> to <to> [on <chain>]',
        '/swap <amount> <from> to <to> [on <chain>]',
        '/settings — настройки свопа (slippage, агрегатор)',
      ].join('\n'),
    );
  }

  private async handlePrice(context: Context): Promise<void> {
    const from = context.from;
    const text = this.getMessageText(context.message);

    if (!from) {
      return;
    }

    if (!text) {
      await context.reply('Команда не распознана. Пример: /price 10 USDC to USDT');
      return;
    }

    try {
      const command = this.parsePriceCommand(text);

      await this.usersRepository.upsertUser({
        id: from.id.toString(),
        username: from.username ?? null,
      });

      const result = await this.priceService.getBestQuote({
        chain: command.chain,
        userId: from.id.toString(),
        amount: command.amount,
        fromSymbol: command.fromSymbol,
        toSymbol: command.toSymbol,
        rawCommand: text,
      });

      await context.reply(this.buildPriceMessage(result));
    } catch (error: unknown) {
      await this.replyWithError(context, 'Price command failed', error);
    }
  }

  private async handleSwap(context: Context): Promise<void> {
    const from = context.from;
    const text = this.getMessageText(context.message);

    if (!from) {
      return;
    }

    if (!text) {
      await context.reply('Команда не распознана. Пример: /swap 10 USDC to USDT');
      return;
    }

    try {
      const command = this.parseSwapCommand(text);

      await this.usersRepository.upsertUser({
        id: from.id.toString(),
        username: from.username ?? null,
      });

      const quotes = await this.swapService.getSwapQuotes({
        chain: command.chain,
        userId: from.id.toString(),
        amount: command.amount,
        fromSymbol: command.fromSymbol,
        toSymbol: command.toSymbol,
        rawCommand: text,
      });

      await context.reply(this.buildSwapQuotesMessage(quotes), {
        reply_markup: {
          inline_keyboard: this.buildSwapButtons(
            quotes.providerQuotes,
            quotes.toSymbol,
            quotes.aggregator,
          ),
        },
      });
    } catch (error: unknown) {
      await this.replyWithError(context, 'Swap command failed', error);
    }
  }

  private async handleSwapCallback(context: Context): Promise<void> {
    const callbackQuery = context.callbackQuery;

    if (!callbackQuery || !('data' in callbackQuery) || !context.from) {
      return;
    }

    const data = callbackQuery.data;
    const selectionToken = data.slice(SWAP_CALLBACK_PREFIX.length);

    if (selectionToken.trim() === '') {
      await context.answerCbQuery('Неверные данные');
      return;
    }

    try {
      await context.answerCbQuery('Подготовка свопа...');
      const session = await this.swapService.createSwapSessionFromSelection(
        context.from.id.toString(),
        selectionToken,
      );

      if (session.chain === 'solana') {
        await this.replySolanaSession(context, session);
        return;
      }

      await this.replyEvmSession(context, session);
    } catch (error: unknown) {
      await this.replyWithError(context, 'Swap callback failed', error);
    }
  }

  private async replySolanaSession(context: Context, session: ISwapSessionResponse): Promise<void> {
    await context.reply(this.buildPreparedSwapMessage(session), {
      reply_markup: {
        inline_keyboard: [[{ text: 'Open in Phantom', url: session.walletConnectUri }]],
      },
    });

    await this.sendQrCode(
      context,
      session.walletConnectUri,
      [
        'Отсканируй QR в Phantom для подключения.',
        `Session ID: ${session.sessionId}`,
        `Сессия истекает: ${this.formatDate(session.expiresAt)}`,
      ].join('\n'),
    );
  }

  private async replyEvmSession(context: Context, session: ISwapSessionResponse): Promise<void> {
    await context.reply(this.buildPreparedSwapMessage(session));
    await this.sendQrCode(
      context,
      session.walletConnectUri,
      [
        'Отсканируй QR в MetaMask или Trust Wallet для подключения.',
        `Session ID: ${session.sessionId}`,
        `Сессия истекает: ${this.formatDate(session.expiresAt)}`,
      ].join('\n'),
    );
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
      `Срок актуальности свопа: ${formatSwapValidity(quotes.quoteExpiresAt)}`,
      `Котировка актуальна до: ${this.formatDate(quotes.quoteExpiresAt)}`,
      `Провайдеров опрошено: ${quotes.providersPolled}`,
      '',
      'Доступные котировки:',
      ...providerQuoteLines,
      '',
      'Выбери агрегатор для свопа:',
    ].join('\n');
  }

  private buildPreparedSwapMessage(session: ISwapSessionResponse): string {
    return [
      'Своп подготовлен.',
      `Сеть: ${session.chain}`,
      `Выбранный агрегатор: ${session.aggregator}`,
      `Gross: ${session.grossToAmount} ${session.toSymbol}`,
      `Комиссия бота: ${session.feeAmount} ${session.feeAmountSymbol ?? session.toSymbol} (${session.feeBps} bps, ${session.feeDisplayLabel})`,
      `Net: ${session.toAmount} ${session.toSymbol}`,
      `Session ID: ${session.sessionId}`,
      `Сессия истекает: ${this.formatDate(session.expiresAt)}`,
      `Срок актуальности свопа: ${formatSwapValidity(session.quoteExpiresAt)}`,
      `Котировка актуальна до: ${this.formatDate(session.quoteExpiresAt)}`,
      this.getConnectionHint(session.chain),
    ].join('\n');
  }

  private buildSwapButtons(
    providerQuotes: readonly IProviderQuote[],
    toSymbol: string,
    bestAggregator: string,
  ): InlineKeyboardButton[][] {
    return providerQuotes.flatMap((quote) => {
      if (!quote.selectionToken) {
        return [];
      }

      const prefix = quote.aggregator === bestAggregator ? '\u2B50 ' : '';
      const feeText = this.buildButtonFeeText(quote, toSymbol);

      return [
        [
          {
            text: `${prefix}${quote.aggregator}: ${quote.toAmount} ${toSymbol} | ${feeText}`,
            callback_data: `${SWAP_CALLBACK_PREFIX}${quote.selectionToken}`,
          },
        ],
      ];
    });
  }

  private buildQuoteLines(quote: IProviderQuote, toSymbol: string): readonly string[] {
    return [
      `- ${quote.aggregator}: gross ${quote.grossToAmount} ${toSymbol}`,
      `  комиссия бота: ${quote.feeAmount} ${quote.feeAmountSymbol ?? toSymbol} (${quote.feeBps} bps, ${quote.feeDisplayLabel})`,
      `  net: ${quote.toAmount} ${toSymbol}`,
    ];
  }

  private buildButtonFeeText(quote: IProviderQuote, toSymbol: string): string {
    if (quote.feeAmount === '0') {
      return 'без комиссии';
    }

    return `${quote.feeDisplayLabel}: ${quote.feeAmount} ${quote.feeAmountSymbol ?? toSymbol}`;
  }

  private getConnectionHint(chain: ChainType): string {
    return chain === 'solana'
      ? 'Открой ссылку в Phantom или отсканируй QR для подключения и подписи транзакции.'
      : 'Открой WalletConnect URI через MetaMask или Trust Wallet.';
  }

  private formatDate(value: string): string {
    return formatLocalDateTime(value, this.dateTimeFormatter);
  }

  private async sendQrCode(context: Context, uri: string, caption: string): Promise<void> {
    try {
      const qrBuffer = await QRCode.toBuffer(uri, {
        type: 'png',
        width: QR_CODE_WIDTH,
        margin: QR_CODE_MARGIN,
      });

      await context.replyWithPhoto(Input.fromBuffer(qrBuffer, 'qr.png'), { caption });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Failed to send QR code: ${errorMessage}`);
    }
  }

  private getMessageText(contextMessage: Context['message']): string | null {
    if (!contextMessage) {
      return null;
    }

    const candidate = contextMessage as Message;

    if ('text' in candidate && typeof candidate.text === 'string') {
      return candidate.text.trim();
    }

    return null;
  }

  private parsePriceCommand(messageText: string): IPriceCommandDto {
    const matches = PRICE_COMMAND_REGEX.exec(messageText);

    if (!matches) {
      throw new BusinessException('Неверный формат. Пример: /price 10 USDC to USDT');
    }

    return {
      amount: this.getMatch(matches, AMOUNT_MATCH_INDEX),
      fromSymbol: this.getMatch(matches, FROM_SYMBOL_MATCH_INDEX).toUpperCase(),
      toSymbol: this.getMatch(matches, TO_SYMBOL_MATCH_INDEX).toUpperCase(),
      chain: this.parseChain(this.getOptionalMatch(matches, CHAIN_MATCH_INDEX)),
    };
  }

  private parseSwapCommand(messageText: string): ISwapCommandDto {
    const matches = SWAP_COMMAND_REGEX.exec(messageText);

    if (!matches) {
      throw new BusinessException('Неверный формат. Пример: /swap 10 USDC to USDT');
    }

    return {
      amount: this.getMatch(matches, AMOUNT_MATCH_INDEX),
      fromSymbol: this.getMatch(matches, FROM_SYMBOL_MATCH_INDEX).toUpperCase(),
      toSymbol: this.getMatch(matches, TO_SYMBOL_MATCH_INDEX).toUpperCase(),
      chain: this.parseChain(this.getOptionalMatch(matches, CHAIN_MATCH_INDEX)),
    };
  }

  private getMatch(matches: RegExpExecArray, index: number): string {
    const value = matches[index];

    if (value === undefined) {
      throw new BusinessException('Неверный формат. Пример: /price 10 USDC to USDT');
    }

    return value;
  }

  private getOptionalMatch(matches: RegExpExecArray, index: number): string | null {
    const value = matches[index];

    if (value === undefined) {
      return null;
    }

    return value.trim();
  }

  private parseChain(rawChain: string | null): ChainType {
    if (rawChain === null || rawChain.trim() === '') {
      return DEFAULT_CHAIN;
    }

    const normalizedChain = rawChain.trim().toLowerCase() as ChainType;

    if (!SUPPORTED_CHAIN_SET.has(normalizedChain)) {
      throw new BusinessException(
        `Сеть ${normalizedChain} не поддерживается. Доступно: ${SUPPORTED_CHAINS.join(', ')}`,
      );
    }

    return normalizedChain;
  }

  private async replyWithError(context: Context, logPrefix: string, error: unknown): Promise<void> {
    const errorMessage = this.getErrorMessage(error);
    this.logger.error(`${logPrefix}: ${errorMessage}`);
    await context.reply(`Ошибка: ${errorMessage}`);
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof BusinessException) {
      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Внутренняя ошибка';
  }
}
