import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { IWalletConnectSwapPayload } from './interfaces/wallet-connect.interface';
import { TELEGRAM_API_BASE_URL, TELEGRAM_PREVIEW_DISABLED } from './wallet-connect.constants';
import { escapeHtml } from './wallet-connect.utils';

@Injectable()
export class WalletConnectPhantomMessagingService {
  private readonly logger = new Logger(WalletConnectPhantomMessagingService.name);
  private readonly telegramBotToken: string;

  public constructor(private readonly configService: ConfigService) {
    this.telegramBotToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
  }

  public async sendConnectedMessage(userId: string, walletAddress: string): Promise<void> {
    await this.sendTelegramMessage(
      userId,
      [
        '👛 <b>Phantom подключён</b>',
        '',
        `🆔 Адрес: <code>${escapeHtml(walletAddress)}</code>`,
      ].join('\n'),
    );
  }

  public async sendSwapSuccessMessage(
    userId: string,
    swapPayload: IWalletConnectSwapPayload,
    transactionHash: string,
    explorerUrl: string,
  ): Promise<void> {
    await this.sendTelegramMessage(
      userId,
      [
        '✅ <b>Своп отправлен</b>',
        '',
        '🌐 Сеть: <code>solana</code>',
        `🏆 Агрегатор: <code>${escapeHtml(swapPayload.aggregatorName)}</code>`,
        `🧾 Tx: <code>${escapeHtml(transactionHash)}</code>`,
        `<a href="${escapeHtml(explorerUrl)}">Открыть в эксплорере</a>`,
      ].join('\n'),
    );
  }

  public async sendErrorMessage(userId: string, message: string): Promise<void> {
    await this.sendTelegramMessage(userId, `❌ <b>Ошибка:</b> ${escapeHtml(message)}`);
  }

  private async sendTelegramMessage(chatId: string, text: string): Promise<void> {
    if (this.telegramBotToken.trim() === '') {
      return;
    }

    const response = await fetch(
      `${TELEGRAM_API_BASE_URL}/bot${this.telegramBotToken}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: TELEGRAM_PREVIEW_DISABLED,
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      this.logger.warn(`Telegram sendMessage failed: ${response.status} ${body}`);
    }
  }
}
