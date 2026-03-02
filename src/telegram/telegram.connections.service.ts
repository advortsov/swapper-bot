import { Injectable, Logger } from '@nestjs/common';
import QRCode from 'qrcode';
import { Input, type Context } from 'telegraf';

import { createDateTimeFormatter, formatLocalDateTime, formatSwapValidity } from './telegram.time';
import type { ChainType } from '../chains/interfaces/chain.interface';
import { SUPPORTED_CHAINS } from '../chains/interfaces/chain.interface';
import { BusinessException } from '../common/exceptions/business.exception';
import type { ISwapSessionResponse } from '../swap/interfaces/swap.interface';
import { WalletConnectService } from '../wallet-connect/wallet-connect.service';

const CONNECT_COMMAND_REGEX = /^\/connect(?:\s+on\s+([a-zA-Z0-9_-]+))?$/i;
const DISCONNECT_COMMAND_REGEX = /^\/disconnect(?:\s+on\s+([a-zA-Z0-9_-]+))?$/i;
const CONNECT_START_PREFIX = 'conn:start:';
const CONNECT_DROP_PREFIX = 'conn:drop:';
const QR_CODE_WIDTH = 512;
const QR_CODE_MARGIN = 2;
const SUPPORTED_CHAIN_SET = new Set<ChainType>(SUPPORTED_CHAINS);

@Injectable()
export class TelegramConnectionsService {
  private readonly logger = new Logger(TelegramConnectionsService.name);
  private readonly dateTimeFormatter: Intl.DateTimeFormat;

  public constructor(private readonly walletConnectService: WalletConnectService) {
    this.dateTimeFormatter = createDateTimeFormatter(process.env['APP_TIMEZONE']);
  }

  public async handleConnect(context: Context, userId: string, text: string): Promise<void> {
    const chain = this.parseConnectChain(text);

    if (!chain) {
      const status = this.walletConnectService.getConnectionStatus(userId);
      await context.reply(this.buildConnectionStatusMessage(status), {
        reply_markup: {
          inline_keyboard: this.buildConnectionButtons(status),
        },
      });
      return;
    }

    const session = await this.walletConnectService.connect({ userId, chain });

    if (!session.uri) {
      await context.reply('Кошелёк уже подключён. Можно выполнять /swap без повторного connect.');
      return;
    }

    await this.replyConnectionSession(context, chain, session);
  }

  public async handleDisconnect(context: Context, userId: string, text: string): Promise<void> {
    const chain = this.parseDisconnectChain(text);

    await this.walletConnectService.disconnect(userId, chain ?? 'all');
    await context.reply(
      chain
        ? `Подключение для ${this.toConnectionLabel(chain)} отключено.`
        : 'Все локальные подключения отключены.',
    );
  }

  public async handleConnectAction(context: Context, userId: string, data: string): Promise<void> {
    const family = data.slice(CONNECT_START_PREFIX.length);
    const chain = family === 'solana' ? 'solana' : 'ethereum';

    await context.answerCbQuery('Создаю подключение...');
    const session = await this.walletConnectService.connect({ userId, chain });

    if (!session.uri) {
      await context.reply('Кошелёк уже подключён.');
      return;
    }

    await this.replyConnectionSession(context, chain, session);
  }

  public async handleDisconnectAction(
    context: Context,
    userId: string,
    data: string,
  ): Promise<void> {
    const family = data.slice(CONNECT_DROP_PREFIX.length);
    const chain = family === 'solana' ? 'solana' : 'ethereum';

    await context.answerCbQuery('Отключаю...');
    await this.walletConnectService.disconnect(userId, chain);
    await context.reply(`Подключение для ${family === 'solana' ? 'Solana' : 'EVM'} отключено.`);
  }

  public async replySwapSession(context: Context, session: ISwapSessionResponse): Promise<void> {
    if (session.walletDelivery === 'connected-wallet') {
      await context.reply(this.buildPreparedSwapMessage(session));
      return;
    }

    if (session.chain === 'solana') {
      await this.replySolanaSession(context, session);
      return;
    }

    await this.replyEvmSession(context, session);
  }

  public isConnectAction(data: string): boolean {
    return data.startsWith(CONNECT_START_PREFIX);
  }

  public isDisconnectAction(data: string): boolean {
    return data.startsWith(CONNECT_DROP_PREFIX);
  }

  private async replySolanaSession(context: Context, session: ISwapSessionResponse): Promise<void> {
    if (session.walletConnectUri) {
      await context.reply(this.buildPreparedSwapMessage(session), {
        reply_markup: {
          inline_keyboard: [[{ text: 'Open in Phantom', url: session.walletConnectUri }]],
        },
      });
      await this.sendQrCode(
        context,
        session.walletConnectUri,
        [
          'Отсканируй QR в Phantom для подписи.',
          `Session ID: ${session.sessionId}`,
          `Сессия истекает: ${this.formatDate(session.expiresAt)}`,
        ].join('\n'),
      );
      return;
    }

    await context.reply(this.buildPreparedSwapMessage(session));
  }

  private async replyEvmSession(context: Context, session: ISwapSessionResponse): Promise<void> {
    await context.reply(this.buildPreparedSwapMessage(session));

    if (session.walletConnectUri) {
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
  }

  private async replyConnectionSession(
    context: Context,
    chain: ChainType,
    session: { uri: string | null; sessionId: string; expiresAt: string },
  ): Promise<void> {
    if (!session.uri) {
      await context.reply('Кошелёк уже подключён.');
      return;
    }

    await context.reply(
      [
        chain === 'solana' ? 'Подключение Phantom' : 'Подключение кошелька',
        `Session ID: ${session.sessionId}`,
        `Сессия истекает: ${this.formatDate(session.expiresAt)}`,
      ].join('\n'),
      chain === 'solana'
        ? {
            reply_markup: {
              inline_keyboard: [[{ text: 'Open in Phantom', url: session.uri }]],
            },
          }
        : undefined,
    );

    await this.sendQrCode(
      context,
      session.uri,
      chain === 'solana'
        ? 'Отсканируй QR в Phantom для подключения.'
        : 'Отсканируй QR в MetaMask или Trust Wallet для подключения.',
    );
  }

  private buildPreparedSwapMessage(session: ISwapSessionResponse): string {
    const deliveryHint =
      session.walletDelivery === 'connected-wallet'
        ? 'Запрос на подпись отправлен в уже подключённый кошелёк.'
        : this.getConnectionHint(session.chain);

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
      'Итоговая транзакция уже собрана с учётом комиссии бота.',
      deliveryHint,
    ].join('\n');
  }

  private buildConnectionStatusMessage(
    status: ReturnType<WalletConnectService['getConnectionStatus']>,
  ): string {
    return [
      'Текущий статус подключений:',
      `EVM: ${status.evm?.address ?? 'не подключён'}`,
      `Solana: ${status.solana?.address ?? 'не подключён'}`,
    ].join('\n');
  }

  private buildConnectionButtons(
    status: ReturnType<WalletConnectService['getConnectionStatus']>,
  ): { text: string; callback_data: string }[][] {
    return [
      [
        {
          text: status.evm ? 'Отключить EVM' : 'Подключить EVM',
          callback_data: `${status.evm ? CONNECT_DROP_PREFIX : CONNECT_START_PREFIX}evm`,
        },
        {
          text: status.solana ? 'Отключить Solana' : 'Подключить Solana',
          callback_data: `${status.solana ? CONNECT_DROP_PREFIX : CONNECT_START_PREFIX}solana`,
        },
      ],
    ];
  }

  private parseConnectChain(text: string): ChainType | null {
    const matches = CONNECT_COMMAND_REGEX.exec(text);

    if (!matches) {
      throw new BusinessException('Команда не распознана. Пример: /connect on ethereum');
    }

    return matches[1] ? this.resolveChain(matches[1]) : null;
  }

  private parseDisconnectChain(text: string): ChainType | null {
    const matches = DISCONNECT_COMMAND_REGEX.exec(text);

    if (!matches) {
      throw new BusinessException('Команда не распознана. Пример: /disconnect on solana');
    }

    return matches[1] ? this.resolveChain(matches[1]) : null;
  }

  private resolveChain(rawValue: string): ChainType {
    const chain = rawValue.toLowerCase() as ChainType;

    if (!SUPPORTED_CHAIN_SET.has(chain)) {
      throw new BusinessException(
        `Сеть ${rawValue} не поддерживается. Доступно: ${SUPPORTED_CHAINS.join(', ')}`,
      );
    }

    return chain;
  }

  private async sendQrCode(context: Context, value: string, caption: string): Promise<void> {
    const qrCodeBuffer = await QRCode.toBuffer(value, {
      width: QR_CODE_WIDTH,
      margin: QR_CODE_MARGIN,
    });

    await context.replyWithPhoto(Input.fromBuffer(qrCodeBuffer), {
      caption,
    });
  }

  private formatDate(value: string): string {
    return formatLocalDateTime(value, this.dateTimeFormatter);
  }

  private toConnectionLabel(chain: ChainType): string {
    return chain === 'solana' ? 'Solana' : 'EVM';
  }

  private getConnectionHint(chain: ChainType): string {
    return chain === 'solana'
      ? 'Открой Phantom и подпиши транзакцию.'
      : 'Открой подключённый EVM-кошелёк и подтверди транзакцию.';
  }
}
