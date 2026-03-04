import { Injectable } from '@nestjs/common';
import type { Context } from 'telegraf';

import { TelegramConnectionsService } from './telegram.connections.service';
import { TelegramTradingApproveService } from './telegram.trading-approve.service';
import { TelegramTradingParserService } from './telegram.trading-parser.service';
import { TelegramTradingQuoteService } from './telegram.trading-quote.service';
import { UsersRepository } from '../database/repositories/users.repository';

@Injectable()
export class TelegramTradingService {
  public constructor(
    private readonly usersRepository: UsersRepository,
    private readonly telegramTradingParserService: TelegramTradingParserService,
    private readonly telegramTradingQuoteService: TelegramTradingQuoteService,
    private readonly telegramTradingApproveService: TelegramTradingApproveService,
  ) {}

  public async handlePrice(
    context: Context,
    userId: string,
    username: string | null,
    text: string,
  ): Promise<void> {
    const command = this.telegramTradingParserService.parsePriceCommand(text);
    await this.upsertUser(userId, username);
    await this.telegramTradingQuoteService.handlePrice(context, userId, text, command);
  }

  public async handleSwap(
    context: Context,
    userId: string,
    username: string | null,
    text: string,
  ): Promise<void> {
    const command = this.telegramTradingParserService.parseSwapCommand(text);
    await this.upsertUser(userId, username);
    await this.telegramTradingQuoteService.handleSwap(context, userId, text, command);
  }

  public async handleApprove(
    context: Context,
    userId: string,
    username: string | null,
    text: string,
  ): Promise<void> {
    const command = this.telegramTradingParserService.parseApproveCommand(text);
    await this.upsertUser(userId, username);
    await this.telegramTradingApproveService.handleApprove(context, userId, command);
  }

  public async handleSwapCallback(
    context: Context,
    userId: string,
    data: string,
    connectionsService: TelegramConnectionsService,
  ): Promise<void> {
    let selectionToken: string;
    try {
      selectionToken = this.telegramTradingParserService.parseSwapSelectionToken(data);
    } catch {
      await context.answerCbQuery('Неверные данные');
      return;
    }

    await this.telegramTradingQuoteService.handleSwapCallback(
      context,
      userId,
      selectionToken,
      connectionsService,
    );
  }

  public async handleApproveCallback(
    context: Context,
    userId: string,
    data: string,
    connectionsService: TelegramConnectionsService,
  ): Promise<void> {
    await this.telegramTradingApproveService.handleApproveCallback(
      context,
      userId,
      this.telegramTradingParserService.parseApproveCallback(data),
      connectionsService,
    );
  }

  public isSwapCallback(data: string): boolean {
    return this.telegramTradingParserService.isSwapCallback(data);
  }

  public isApproveCallback(data: string): boolean {
    return this.telegramTradingParserService.isApproveCallback(data);
  }

  private async upsertUser(userId: string, username: string | null): Promise<void> {
    await this.usersRepository.upsertUser({ id: userId, username });
  }
}
