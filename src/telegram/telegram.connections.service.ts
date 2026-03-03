import { Injectable, Logger } from '@nestjs/common';
import QRCode from 'qrcode';
import { Input, type Context } from 'telegraf';

import {
  buildConnectionSessionMessage,
  buildConnectionStatusMessage,
  buildDisconnectMessage,
  buildPreparedSwapMessage,
  buildQrCaption,
  buildInfoMessage,
} from './telegram.message-formatters';
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
const METAMASK_UNIVERSAL_LINK = 'https://link.metamask.io/wc?uri=';
const METAMASK_LEGACY_LINK = 'https://metamask.app.link/wc?uri=';
const TRUST_WALLET_UNIVERSAL_LINK = 'https://link.trustwallet.com/wc?uri=';

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
      await context.reply(buildConnectionStatusMessage(status), {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: this.buildConnectionButtons(status),
        },
      });
      return;
    }

    const session = await this.walletConnectService.connect({ userId, chain });

    if (!session.uri) {
      await context.reply(
        buildInfoMessage('Кошелёк уже подключён. Можно выполнять /swap без повторного connect.'),
        { parse_mode: 'HTML' },
      );
      return;
    }

    await this.replyConnectionSession(context, chain, session);
  }

  public async handleDisconnect(context: Context, userId: string, text: string): Promise<void> {
    const chain = this.parseDisconnectChain(text);

    await this.walletConnectService.disconnect(userId, chain ?? 'all');
    await context.reply(buildDisconnectMessage(chain), { parse_mode: 'HTML' });
  }

  public async handleConnectAction(context: Context, userId: string, data: string): Promise<void> {
    const family = data.slice(CONNECT_START_PREFIX.length);
    const chain = family === 'solana' ? 'solana' : 'ethereum';

    await context.answerCbQuery('Создаю подключение...');
    const session = await this.walletConnectService.connect({ userId, chain });

    if (!session.uri) {
      await context.reply(buildInfoMessage('Кошелёк уже подключён.'), { parse_mode: 'HTML' });
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
    await context.reply(buildDisconnectMessage(chain), { parse_mode: 'HTML' });
  }

  public async replySwapSession(context: Context, session: ISwapSessionResponse): Promise<void> {
    if (session.walletDelivery === 'connected-wallet') {
      await context.reply(this.buildPreparedSwapMessage(session), { parse_mode: 'HTML' });
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
    const swapValidityText = this.formatSwapSessionValidity(session);

    if (session.walletConnectUri) {
      await context.reply(this.buildPreparedSwapMessage(session), {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: 'Open in Phantom', url: session.walletConnectUri }]],
        },
      });
      await this.sendQrCode(
        context,
        session.walletConnectUri,
        buildQrCaption('swap', session.chain, session.sessionId, swapValidityText),
      );
      return;
    }

    await context.reply(this.buildPreparedSwapMessage(session), { parse_mode: 'HTML' });
  }

  private async replyEvmSession(context: Context, session: ISwapSessionResponse): Promise<void> {
    const swapValidityText = this.formatSwapSessionValidity(session);

    if (session.walletConnectUri) {
      await context.reply(this.buildPreparedSwapMessage(session), {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Open in MetaMask',
                url: `${METAMASK_UNIVERSAL_LINK}${encodeURIComponent(session.walletConnectUri)}`,
              },
              {
                text: 'Open in Trust Wallet',
                url: `${TRUST_WALLET_UNIVERSAL_LINK}${encodeURIComponent(session.walletConnectUri)}`,
              },
            ],
            [
              {
                text: 'MetaMask (legacy link)',
                url: `${METAMASK_LEGACY_LINK}${encodeURIComponent(session.walletConnectUri)}`,
              },
            ],
          ],
        },
      });
      await this.sendQrCode(
        context,
        session.walletConnectUri,
        buildQrCaption('swap', session.chain, session.sessionId, swapValidityText),
      );
      return;
    }

    await context.reply(this.buildPreparedSwapMessage(session), { parse_mode: 'HTML' });
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
      buildConnectionSessionMessage(chain, session.sessionId, this.formatDate(session.expiresAt)),
      chain === 'solana'
        ? {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[{ text: 'Open in Phantom', url: session.uri }]],
            },
          }
        : { parse_mode: 'HTML' },
    );

    await this.sendQrCode(
      context,
      session.uri,
      buildQrCaption('connect', chain, session.sessionId, this.formatDate(session.expiresAt)),
    );
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

  private formatSwapSessionValidity(session: ISwapSessionResponse): string {
    return formatSwapValidity(this.resolveSoonestExpiry(session.expiresAt, session.quoteExpiresAt));
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
      parse_mode: 'HTML',
    });
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
