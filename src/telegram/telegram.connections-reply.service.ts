import { Injectable } from '@nestjs/common';
import type { Context } from 'telegraf';

import { TelegramConnectionsLinksService } from './telegram.connections-links.service';
import {
  buildPreparedApproveMessage,
  buildConnectionSessionMessage,
  buildConnectionStatusMessage,
  buildDisconnectMessage,
  buildPreparedSwapMessage,
  buildQrCaption,
  buildInfoMessage,
} from './telegram.message-formatters';
import { TelegramQrService } from './telegram.qr.service';
import { createDateTimeFormatter, formatLocalDateTime, formatSwapValidity } from './telegram.time';
import type { IApproveSessionResponse } from '../allowance/interfaces/allowance.interface';
import type { ChainType } from '../chains/interfaces/chain.interface';
import type { ISwapSessionResponse } from '../swap/interfaces/swap.interface';
import type { WalletConnectService } from '../wallet-connect/wallet-connect.service';

@Injectable()
export class TelegramConnectionsReplyService {
  private readonly dateTimeFormatter: Intl.DateTimeFormat;

  public constructor(
    private readonly telegramConnectionsLinksService: TelegramConnectionsLinksService,
    private readonly telegramQrService: TelegramQrService,
  ) {
    this.dateTimeFormatter = createDateTimeFormatter(process.env['APP_TIMEZONE']);
  }

  public async replyConnectionStatus(
    context: Context,
    status: ReturnType<WalletConnectService['getConnectionStatus']>,
    buttons: { text: string; callback_data: string }[][],
  ): Promise<void> {
    await context.reply(buildConnectionStatusMessage(status), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: buttons,
      },
    });
  }

  public async replyAlreadyConnected(context: Context, message: string): Promise<void> {
    await context.reply(buildInfoMessage(message), { parse_mode: 'HTML' });
  }

  public async replyDisconnectMessage(context: Context, chain: ChainType | null): Promise<void> {
    await context.reply(buildDisconnectMessage(chain), { parse_mode: 'HTML' });
  }

  public async replySwapSession(context: Context, session: ISwapSessionResponse): Promise<void> {
    if (session.walletDelivery === 'connected-wallet') {
      await context.reply(this.buildPreparedSwapMessage(session), { parse_mode: 'HTML' });
      return;
    }

    if (session.chain === 'solana') {
      await this.replySolanaSwapSession(context, session);
      return;
    }

    await this.replyEvmSwapSession(context, session);
  }

  public async replyApproveSession(
    context: Context,
    session: IApproveSessionResponse,
  ): Promise<void> {
    const replyText = this.buildPreparedApproveMessage(session);

    if (session.walletDelivery === 'connected-wallet' || !session.walletConnectUri) {
      await context.reply(replyText, { parse_mode: 'HTML' });
      return;
    }

    await context.reply(replyText, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: this.telegramConnectionsLinksService.buildEvmWalletKeyboard(
          session.walletConnectUri,
        ),
      },
    });
    await this.telegramQrService.sendQrCode(
      context,
      session.walletConnectUri,
      buildQrCaption(
        'approve',
        session.chain,
        session.sessionId,
        this.formatSwapValidityText(session.expiresAt),
      ),
    );
  }

  public async replyConnectionSession(
    context: Context,
    chain: ChainType,
    session: { uri: string | null; sessionId: string; expiresAt: string },
  ): Promise<void> {
    if (!session.uri) {
      await context.reply('Кошелёк уже подключён.');
      return;
    }

    await context.reply(
      buildConnectionSessionMessage(chain, session.sessionId, this.formatDate(session.expiresAt)),
      chain === 'solana'
        ? {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: this.telegramConnectionsLinksService.buildSolanaWalletKeyboard(
                session.uri,
              ),
            },
          }
        : { parse_mode: 'HTML' },
    );

    await this.telegramQrService.sendQrCode(
      context,
      session.uri,
      buildQrCaption('connect', chain, session.sessionId, this.formatDate(session.expiresAt)),
    );
  }

  private async replySolanaSwapSession(
    context: Context,
    session: ISwapSessionResponse,
  ): Promise<void> {
    const swapValidityText = this.formatSwapSessionValidity(session);

    if (session.walletConnectUri) {
      await context.reply(this.buildPreparedSwapMessage(session), {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: this.telegramConnectionsLinksService.buildSolanaWalletKeyboard(
            session.walletConnectUri,
          ),
        },
      });
      await this.telegramQrService.sendQrCode(
        context,
        session.walletConnectUri,
        buildQrCaption('swap', session.chain, session.sessionId, swapValidityText),
      );
      return;
    }

    await context.reply(this.buildPreparedSwapMessage(session), { parse_mode: 'HTML' });
  }

  private async replyEvmSwapSession(
    context: Context,
    session: ISwapSessionResponse,
  ): Promise<void> {
    const swapValidityText = this.formatSwapSessionValidity(session);

    if (session.walletConnectUri) {
      await context.reply(this.buildPreparedSwapMessage(session), {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: this.telegramConnectionsLinksService.buildEvmWalletKeyboard(
            session.walletConnectUri,
          ),
        },
      });
      await this.telegramQrService.sendQrCode(
        context,
        session.walletConnectUri,
        buildQrCaption('swap', session.chain, session.sessionId, swapValidityText),
      );
      return;
    }

    await context.reply(this.buildPreparedSwapMessage(session), { parse_mode: 'HTML' });
  }

  private buildPreparedSwapMessage(session: ISwapSessionResponse): string {
    const deliveryHint =
      session.walletDelivery === 'connected-wallet'
        ? 'Запрос на подпись отправлен в уже подключённый кошелёк.'
        : this.getConnectionHint(session.chain);

    return buildPreparedSwapMessage({
      session,
      swapValidityText: this.formatSwapSessionValidity(session),
      deliveryHint,
    });
  }

  private buildPreparedApproveMessage(session: IApproveSessionResponse): string {
    const deliveryHint =
      session.walletDelivery === 'connected-wallet'
        ? 'Запрос на approve отправлен в уже подключённый кошелёк.'
        : 'Открой подключённый EVM-кошелёк и подтверди approve.';

    return buildPreparedApproveMessage({
      session,
      expiryText: this.formatSwapValidityText(session.expiresAt),
      deliveryHint,
    });
  }

  private formatSwapSessionValidity(session: ISwapSessionResponse): string {
    return formatSwapValidity(this.resolveSoonestExpiry(session.expiresAt, session.quoteExpiresAt));
  }

  private formatSwapValidityText(expiresAt: string): string {
    return formatSwapValidity(expiresAt);
  }

  private resolveSoonestExpiry(first: string, second: string): string {
    const firstMs = new Date(first).getTime();
    const secondMs = new Date(second).getTime();

    if (Number.isNaN(firstMs)) {
      return second;
    }

    if (Number.isNaN(secondMs)) {
      return first;
    }

    return new Date(Math.min(firstMs, secondMs)).toISOString();
  }

  private formatDate(value: string): string {
    return formatLocalDateTime(value, this.dateTimeFormatter);
  }

  private getConnectionHint(chain: ChainType): string {
    return chain === 'solana'
      ? 'Открой Phantom и подпиши транзакцию.'
      : 'Открой подключённый EVM-кошелёк и подтверди транзакцию.';
  }
}
