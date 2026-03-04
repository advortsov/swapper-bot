import { Injectable } from '@nestjs/common';
import QRCode from 'qrcode';
import { Input, type Context } from 'telegraf';

const QR_CODE_WIDTH = 512;
const QR_CODE_MARGIN = 2;

@Injectable()
export class TelegramQrService {
  public async sendQrCode(context: Context, value: string, caption: string): Promise<void> {
    const qrCodeBuffer = await QRCode.toBuffer(value, {
      width: QR_CODE_WIDTH,
      margin: QR_CODE_MARGIN,
    });

    await context.replyWithPhoto(Input.fromBuffer(qrCodeBuffer), {
      caption,
      parse_mode: 'HTML',
    });
  }
}
