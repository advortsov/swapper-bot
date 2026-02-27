import { Injectable, Logger } from '@nestjs/common';
import { Context, Telegraf } from 'telegraf';
import type { Message } from 'telegraf/typings/core/types/typegram';

import { BusinessException } from '../common/exceptions/business.exception';
import { UsersRepository } from '../database/repositories/users.repository';
import { PriceService } from '../price/price.service';
import type { IPriceCommandDto } from './dto/price-command.dto';

const PRICE_COMMAND_REGEX = /^\/price\s+([0-9]*\.?[0-9]+)\s+([a-zA-Z0-9]+)\s+to\s+([a-zA-Z0-9]+)$/i;
const GAS_USD_PRECISION = 4;
const AMOUNT_MATCH_INDEX = 1;
const FROM_SYMBOL_MATCH_INDEX = 2;
const TO_SYMBOL_MATCH_INDEX = 3;

@Injectable()
export class TelegramUpdateHandler {
  private readonly logger = new Logger(TelegramUpdateHandler.name);

  public constructor(
    private readonly priceService: PriceService,
    private readonly usersRepository: UsersRepository,
  ) {}

  public register(bot: Telegraf): void {
    bot.command('start', async (context: Context) => this.handleStart(context));
    bot.command('price', async (context: Context) => this.handlePrice(context));
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
      'Привет! Используй команду /price <amount> <from> to <to>, например /price 10 USDC to USDT',
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

      await context.reply(
        [
          `Лучший курс для ${result.fromAmount} ${result.fromSymbol} -> ${result.toAmount} ${result.toSymbol}`,
          `Сеть: ${result.chain}`,
          `Агрегатор: ${result.aggregator}`,
          `Оценка газа в USD: ${gasText}`,
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
    };
  }

  private getMatch(matches: RegExpExecArray, index: number): string {
    const value = matches[index];

    if (value === undefined) {
      throw new BusinessException('Неверный формат. Пример: /price 10 USDC to USDT');
    }

    return value;
  }
}
