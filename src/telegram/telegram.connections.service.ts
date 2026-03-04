import { Inject, Injectable } from '@nestjs/common';
import type { Context } from 'telegraf';

import { TelegramConnectionsParserService } from './telegram.connections-parser.service';
import { TelegramConnectionsReplyService } from './telegram.connections-reply.service';
import type { IApproveSessionResponse } from '../allowance/interfaces/allowance.interface';
import type { ISwapSessionResponse } from '../swap/interfaces/swap.interface';
import { WalletConnectService } from '../wallet-connect/wallet-connect.service';

@Injectable()
export class TelegramConnectionsService {
  @Inject()
  private readonly telegramConnectionsParserService!: TelegramConnectionsParserService;

  @Inject()
  private readonly telegramConnectionsReplyService!: TelegramConnectionsReplyService;

  public constructor(private readonly walletConnectService: WalletConnectService) {}

  public async handleConnect(context: Context, userId: string, text: string): Promise<void> {
    const chain = this.telegramConnectionsParserService.parseConnectChain(text);

    if (!chain) {
      const status = this.walletConnectService.getConnectionStatus(userId);
      await this.telegramConnectionsReplyService.replyConnectionStatus(
        context,
        status,
        this.telegramConnectionsParserService.buildConnectionButtons(status),
      );
      return;
    }

    const session = await this.walletConnectService.connect({ userId, chain });

    if (!session.uri) {
      await this.telegramConnectionsReplyService.replyAlreadyConnected(
        context,
        'Кошелёк уже подключён. Можно выполнять /swap без повторного connect.',
      );
      return;
    }

    await this.telegramConnectionsReplyService.replyConnectionSession(context, chain, session);
  }

  public async handleDisconnect(context: Context, userId: string, text: string): Promise<void> {
    const chain = this.telegramConnectionsParserService.parseDisconnectChain(text);

    await this.walletConnectService.disconnect(userId, chain ?? 'all');
    await this.telegramConnectionsReplyService.replyDisconnectMessage(context, chain);
  }

  public async handleConnectAction(context: Context, userId: string, data: string): Promise<void> {
    const chain = this.telegramConnectionsParserService.resolveConnectActionChain(data);

    await context.answerCbQuery('Создаю подключение...');
    const session = await this.walletConnectService.connect({ userId, chain });

    if (!session.uri) {
      await this.telegramConnectionsReplyService.replyAlreadyConnected(
        context,
        'Кошелёк уже подключён.',
      );
      return;
    }

    await this.telegramConnectionsReplyService.replyConnectionSession(context, chain, session);
  }

  public async handleDisconnectAction(
    context: Context,
    userId: string,
    data: string,
  ): Promise<void> {
    const chain = this.telegramConnectionsParserService.resolveDisconnectActionChain(data);

    await context.answerCbQuery('Отключаю...');
    await this.walletConnectService.disconnect(userId, chain);
    await this.telegramConnectionsReplyService.replyDisconnectMessage(context, chain);
  }

  public async replySwapSession(context: Context, session: ISwapSessionResponse): Promise<void> {
    await this.telegramConnectionsReplyService.replySwapSession(context, session);
  }

  public async replyApproveSession(
    context: Context,
    session: IApproveSessionResponse,
  ): Promise<void> {
    await this.telegramConnectionsReplyService.replyApproveSession(context, session);
  }

  public isConnectAction(data: string): boolean {
    return this.telegramConnectionsParserService.isConnectAction(data);
  }

  public isDisconnectAction(data: string): boolean {
    return this.telegramConnectionsParserService.isDisconnectAction(data);
  }
}
