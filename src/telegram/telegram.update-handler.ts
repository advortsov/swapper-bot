import { Injectable, Logger } from '@nestjs/common';
import QRCode from 'qrcode';
import { Context, Telegraf } from 'telegraf';
import { Input } from 'telegraf';
import { message } from 'telegraf/filters';
import type { InlineKeyboardButton, Message } from 'telegraf/typings/core/types/typegram';

import {
  DEFAULT_CHAIN,
  SUPPORTED_CHAINS,
  type ChainType,
} from '../chains/interfaces/chain.interface';
import { BusinessException } from '../common/exceptions/business.exception';
import { UsersRepository } from '../database/repositories/users.repository';
import { PriceService } from '../price/price.service';
import type { IPriceCommandDto } from './dto/price-command.dto';
import { SwapService } from '../swap/swap.service';
import type { ISwapCommandDto } from './dto/swap-command.dto';
import { TelegramSettingsHandler } from './telegram.settings-handler';
import type { ISwapRequest, ISwapSessionResponse } from '../swap/interfaces/swap.interface';

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
const PENDING_SWAP_TTL_MS = 300_000;
const QR_CODE_WIDTH = 512;
const QR_CODE_MARGIN = 2;

interface IPendingSwap {
  request: ISwapRequest;
  createdAt: number;
}

@Injectable()
export class TelegramUpdateHandler {
  private readonly logger = new Logger(TelegramUpdateHandler.name);
  private readonly pendingSwaps = new Map<string, IPendingSwap>();
  private swapCounter = 0;

  public constructor(
    private readonly priceService: PriceService,
    private readonly swapService: SwapService,
    private readonly usersRepository: UsersRepository,
    private readonly settingsHandler: TelegramSettingsHandler,
  ) {}

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

    if (!from) {
      return;
    }

    const text = this.getMessageText(context.message);

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

      const gasText =
        result.estimatedGasUsd === null
          ? 'N/A'
          : `$${result.estimatedGasUsd.toFixed(GAS_USD_PRECISION)}`;
      const providerQuoteLines = result.providerQuotes.map(
        (quote) => `- ${quote.aggregator}: ${quote.toAmount} ${result.toSymbol}`,
      );

      await context.reply(
        [
          `Лучший курс для ${result.fromAmount} ${result.fromSymbol} -> ${result.toAmount} ${result.toSymbol}`,
          `Сеть: ${result.chain}`,
          `Агрегатор: ${result.aggregator}`,
          `Оценка газа в USD: ${gasText}`,
          `Провайдеров опрошено: ${result.providersPolled}`,
          'Котировки провайдеров:',
          ...providerQuoteLines,
        ].join('\n'),
      );
    } catch (error: unknown) {
      const errorMessage = this.getErrorMessage(error);

      this.logger.error(`Price command failed: ${errorMessage}`);
      await context.reply(`Ошибка: ${errorMessage}`);
    }
  }

  private async handleSwap(context: Context): Promise<void> {
    const from = context.from;

    if (!from) {
      return;
    }

    const text = this.getMessageText(context.message);

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

      const request: ISwapRequest = {
        chain: command.chain,
        userId: from.id.toString(),
        amount: command.amount,
        fromSymbol: command.fromSymbol,
        toSymbol: command.toSymbol,
        rawCommand: text,
      };

      const quotes = await this.swapService.getSwapQuotes(request);

      this.swapCounter += 1;
      const swapId = `${from.id}_${this.swapCounter}`;
      this.pendingSwaps.set(swapId, { request, createdAt: Date.now() });
      this.cleanExpiredSwaps();

      const buttons: InlineKeyboardButton[][] = quotes.providerQuotes.map((quote) => {
        const isBest = quote.aggregator === quotes.aggregator;
        const prefix = isBest ? '\u2B50 ' : '';

        return [
          {
            text: `${prefix}${quote.aggregator}: ${quote.toAmount} ${quotes.toSymbol}`,
            callback_data: `sw:${swapId}:${quote.aggregator}`,
          },
        ];
      });

      await context.reply(
        [
          `Котировки для ${quotes.fromAmount} ${quotes.fromSymbol} \u2192 ${quotes.toAmount} ${quotes.toSymbol}`,
          `Сеть: ${quotes.chain}`,
          `Лучший агрегатор: ${quotes.aggregator}`,
          `Провайдеров опрошено: ${quotes.providersPolled}`,
          '',
          'Выбери агрегатор для свопа:',
        ].join('\n'),
        { reply_markup: { inline_keyboard: buttons } },
      );
    } catch (error: unknown) {
      const errorMessage = this.getErrorMessage(error);

      this.logger.error(`Swap command failed: ${errorMessage}`);
      await context.reply(`Ошибка: ${errorMessage}`);
    }
  }

  private async handleSwapCallback(context: Context): Promise<void> {
    const callbackQuery = context.callbackQuery;

    if (!callbackQuery || !('data' in callbackQuery)) {
      return;
    }

    const data = callbackQuery.data;
    const payload = data.slice(SWAP_CALLBACK_PREFIX.length);
    const lastColonIndex = payload.lastIndexOf(':');

    if (lastColonIndex < 0) {
      await context.answerCbQuery('Неверные данные');
      return;
    }

    const swapId = payload.slice(0, lastColonIndex);
    const aggregatorName = payload.slice(lastColonIndex + 1);

    const pending = this.pendingSwaps.get(swapId);

    if (!pending || Date.now() - pending.createdAt > PENDING_SWAP_TTL_MS) {
      this.pendingSwaps.delete(swapId);
      await context.answerCbQuery('Своп истёк. Отправь /swap заново.');
      return;
    }

    this.pendingSwaps.delete(swapId);

    try {
      await context.answerCbQuery('Подготовка свопа...');

      const session = await this.swapService.createSwapSession(pending.request, aggregatorName);

      if (session.chain === 'solana') {
        await this.replySolanaSession(context, session);
      } else {
        await this.replyEvmSession(context, session);
      }
    } catch (error: unknown) {
      const errorMessage = this.getErrorMessage(error);

      this.logger.error(`Swap callback failed: ${errorMessage}`);
      await context.reply(`Ошибка: ${errorMessage}`);
    }
  }

  private async replySolanaSession(context: Context, session: ISwapSessionResponse): Promise<void> {
    await context.reply(
      [
        'Своп подготовлен.',
        `Session ID: ${session.sessionId}`,
        'Открой ссылку в Phantom или отсканируй QR для подключения и подписи транзакции.',
        `Сессия истекает: ${session.expiresAt}`,
      ].join('\n'),
      {
        reply_markup: {
          inline_keyboard: [[{ text: 'Open in Phantom', url: session.walletConnectUri }]],
        },
      },
    );

    await this.sendQrCode(
      context,
      session.walletConnectUri,
      'Отсканируй QR в Phantom для подключения.',
    );
  }

  private async replyEvmSession(context: Context, session: ISwapSessionResponse): Promise<void> {
    await this.sendQrCode(
      context,
      session.walletConnectUri,
      [
        'Отсканируй QR в MetaMask или Trust Wallet для подключения.',
        `Session ID: ${session.sessionId}`,
        `Сессия истекает: ${session.expiresAt}`,
      ].join('\n'),
    );
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

  private cleanExpiredSwaps(): void {
    const now = Date.now();

    for (const [id, swap] of this.pendingSwaps) {
      if (now - swap.createdAt > PENDING_SWAP_TTL_MS) {
        this.pendingSwaps.delete(id);
      }
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
