import { Injectable, Logger } from '@nestjs/common';
import QRCode from 'qrcode';
import { Context, Telegraf } from 'telegraf';
import { Input } from 'telegraf';
import { message } from 'telegraf/filters';
import type { Message } from 'telegraf/typings/core/types/typegram';

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

@Injectable()
export class TelegramUpdateHandler {
  private readonly logger = new Logger(TelegramUpdateHandler.name);

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
      const message =
        error instanceof BusinessException
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Внутренняя ошибка';

      this.logger.error(`Price command failed: ${message}`);
      await context.reply(`Ошибка: ${message}`);
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

      const session = await this.swapService.createSwapSession({
        chain: command.chain,
        userId: from.id.toString(),
        amount: command.amount,
        fromSymbol: command.fromSymbol,
        toSymbol: command.toSymbol,
        rawCommand: text,
      });
      await this.replySwapPrepared(context, session);
    } catch (error: unknown) {
      const message =
        error instanceof BusinessException
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Внутренняя ошибка';

      this.logger.error(`Swap command failed: ${message}`);
      await context.reply(`Ошибка: ${message}`);
    }
  }

  private getMessageText(message: Context['message']): string | null {
    if (!message) {
      return null;
    }

    const candidate = message as Message;

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

  private async sendWalletConnectQr(context: Context, walletConnectUri: string): Promise<void> {
    try {
      const qrBuffer = await QRCode.toBuffer(walletConnectUri, {
        type: 'png',
        width: 512,
        margin: 2,
      });

      await context.replyWithPhoto(Input.fromBuffer(qrBuffer, 'qr.png'), {
        caption: 'Отсканируй QR в MetaMask или Trust Wallet для подключения.',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Failed to send WC QR code: ${message}`);
    }
  }

  private buildWalletConnectLinks(walletConnectUri: string): {
    metamask: string;
    metamaskLegacy: string;
    trustWallet: string;
  } {
    const encodedUri = encodeURIComponent(walletConnectUri);

    return {
      metamask: `https://link.metamask.io/wc?uri=${encodedUri}`,
      metamaskLegacy: `https://metamask.app.link/wc?uri=${encodedUri}`,
      trustWallet: `https://link.trustwallet.com/wc?uri=${encodedUri}`,
    };
  }

  private async replySwapPrepared(
    context: Context,
    session: Awaited<ReturnType<SwapService['createSwapSession']>>,
  ): Promise<void> {
    if (session.chain === 'solana') {
      await this.replySolanaSwapPrepared(context, session);
      return;
    }

    await this.replyEvmSwapPrepared(context, session);
  }

  private async replySolanaSwapPrepared(
    context: Context,
    session: Awaited<ReturnType<SwapService['createSwapSession']>>,
  ): Promise<void> {
    const providerQuoteLines = session.providerQuotes.map(
      (quote) => `- ${quote.aggregator}: ${quote.toAmount} ${session.toSymbol}`,
    );
    await context.reply(
      [
        `Подготовлен своп ${session.fromAmount} ${session.fromSymbol} -> ${session.toAmount} ${session.toSymbol}`,
        `Сеть: ${session.chain}`,
        `Выбранный агрегатор: ${session.aggregator}`,
        `Провайдеров опрошено: ${session.providersPolled}`,
        'Котировки провайдеров:',
        ...providerQuoteLines,
        `Session ID: ${session.sessionId}`,
        'Открой ссылку ниже в Phantom для подключения и подписи транзакции.',
        `Phantom link: ${session.walletConnectUri}`,
        `Сессия истекает: ${session.expiresAt}`,
      ].join('\n'),
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Open in Phantom',
                url: session.walletConnectUri,
              },
            ],
          ],
        },
      },
    );
  }

  private async replyEvmSwapPrepared(
    context: Context,
    session: Awaited<ReturnType<SwapService['createSwapSession']>>,
  ): Promise<void> {
    const providerQuoteLines = session.providerQuotes.map(
      (quote) => `- ${quote.aggregator}: ${quote.toAmount} ${session.toSymbol}`,
    );
    const walletConnectLinks = this.buildWalletConnectLinks(session.walletConnectUri);

    await context.replyWithHTML(
      [
        `Подготовлен своп ${session.fromAmount} ${session.fromSymbol} → ${session.toAmount} ${session.toSymbol}`,
        `Сеть: ${session.chain}`,
        `Агрегатор: ${session.aggregator}`,
        `Провайдеров: ${session.providersPolled}`,
        ...providerQuoteLines,
        '',
        'Нажми кнопку или отсканируй QR в кошельке.',
        `Сессия истекает: ${session.expiresAt}`,
      ].join('\n'),
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'MetaMask',
                url: walletConnectLinks.metamask,
              },
              {
                text: 'Trust Wallet',
                url: walletConnectLinks.trustWallet,
              },
            ],
            [
              {
                text: 'MetaMask (alt link)',
                url: walletConnectLinks.metamaskLegacy,
              },
            ],
          ],
        },
      },
    );

    await this.sendWalletConnectQr(context, session.walletConnectUri);
  }
}
