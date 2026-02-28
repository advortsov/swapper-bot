import { Controller, Get, Logger, Query, Res } from '@nestjs/common';

import type { IPhantomCallbackQuery } from './interfaces/wallet-connect.interface';
import { renderWalletConnectPage } from './wallet-connect.page';
import { WalletConnectService } from './wallet-connect.service';
import { BusinessException } from '../common/exceptions/business.exception';

const HTML_STATUS_OK = 200;
const HTML_STATUS_BAD_REQUEST = 400;
const HTML_STATUS_INTERNAL_ERROR = 500;

interface IHtmlResponse {
  status(code: number): IHtmlResponse;
  type(contentType: string): IHtmlResponse;
  send(body: string): IHtmlResponse;
}

@Controller('phantom')
export class WalletConnectController {
  private readonly logger = new Logger(WalletConnectController.name);

  public constructor(private readonly walletConnectService: WalletConnectService) {}

  @Get('connect')
  public openPhantom(
    @Query('sessionId') sessionId: string | undefined,
    @Res() response: IHtmlResponse,
  ): void {
    try {
      const deeplink = this.walletConnectService.getPhantomConnectUrl(sessionId ?? '');
      this.sendPage(response, {
        title: 'Открыть Phantom',
        heading: 'Подключение кошелька Phantom',
        text: 'Нажми кнопку ниже. Если Phantom не открылся автоматически, открой ссылку вручную.',
        primaryLink: deeplink,
        primaryLabel: 'Open Phantom',
        autoRedirect: true,
      });
    } catch (error: unknown) {
      this.sendErrorPage(response, error, 'Не удалось открыть Phantom');
    }
  }

  @Get('callback/connect')
  public async handleConnectCallback(
    @Query() query: IPhantomCallbackQuery,
    @Res() response: IHtmlResponse,
  ): Promise<void> {
    try {
      const deeplink = await this.walletConnectService.handlePhantomConnectCallback(query);
      this.sendPage(response, {
        title: 'Продолжить в Phantom',
        heading: 'Кошелёк подключён',
        text: 'Phantom вернёт тебя в приложение для подписи транзакции.',
        primaryLink: deeplink,
        primaryLabel: 'Подписать в Phantom',
        autoRedirect: true,
      });
    } catch (error: unknown) {
      this.sendErrorPage(response, error, 'Не удалось подготовить подпись в Phantom');
    }
  }

  @Get('callback/sign')
  public async handleSignCallback(
    @Query() query: IPhantomCallbackQuery,
    @Res() response: IHtmlResponse,
  ): Promise<void> {
    try {
      const result = await this.walletConnectService.handlePhantomSignCallback(query);
      this.sendPage(response, {
        title: 'Своп отправлен',
        heading: 'Транзакция отправлена',
        text: `Tx: ${result.transactionHash}`,
        primaryLink: result.explorerUrl,
        primaryLabel: 'Открыть в эксплорере',
        autoRedirect: false,
      });
    } catch (error: unknown) {
      this.sendErrorPage(response, error, 'Своп не был отправлен');
    }
  }

  private sendPage(
    response: IHtmlResponse,
    input: Parameters<typeof renderWalletConnectPage>[0],
  ): void {
    response.status(HTML_STATUS_OK).type('html').send(renderWalletConnectPage(input));
  }

  private sendErrorPage(response: IHtmlResponse, error: unknown, heading: string): void {
    const message = this.getErrorMessage(error);
    const statusCode =
      error instanceof BusinessException ? HTML_STATUS_BAD_REQUEST : HTML_STATUS_INTERNAL_ERROR;
    this.logger.error(`${heading}: ${message}`);
    response
      .status(statusCode)
      .type('html')
      .send(
        renderWalletConnectPage({
          title: heading,
          heading,
          text: message,
          autoRedirect: false,
        }),
      );
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof BusinessException) {
      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown internal error';
  }
}
