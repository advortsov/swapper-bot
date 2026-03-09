import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Context } from 'telegraf';

import type { ChainType } from '../chains/interfaces/chain.interface';
import { TokensService } from '../tokens/tokens.service';
import { TradePresetsService } from '../trade-presets/trade-presets.service';
import { WalletConnectSessionStore } from '../wallet-connect/wallet-connect.session-store';
import { escapeHtml } from '../wallet-connect/wallet-connect.utils';

const TEMPLATE_ADD_PREFIX = 'tpl:add:';
const TEMPLATE_DELETE_PREFIX = 'tpl:del:';
const CALLBACK_TOKEN_BYTES = 9;

interface IPresetCreationPayload {
  chain: string;
  amount: string;
  fromTokenAddress: string;
  toTokenAddress: string;
}

@Injectable()
export class TelegramTradeTemplatesService {
  private readonly logger = new Logger(TelegramTradeTemplatesService.name);

  public constructor(
    private readonly tradePresetsService: TradePresetsService,
    private readonly sessionStore: WalletConnectSessionStore,
    private readonly tokensService: TokensService,
  ) {}

  public async handleTemplates(context: Context, userId: string): Promise<void> {
    const presets = await this.tradePresetsService.listPresets(userId);

    if (presets.length === 0) {
      await context.reply(
        '📋 <b>Пресетов пока нет</b>\n\nСоздай пресет кнопкой "Сохранить" из <code>/price</code> или <code>/swap</code>.',
        { parse_mode: 'HTML' },
      );
      return;
    }

    const lines = ['📋 <b>Пресеты</b>'];

    for (const [index, preset] of presets.entries()) {
      const label = escapeHtml(preset.label);
      const pair = `${preset.sellTokenSymbol} → ${preset.buyTokenSymbol}`;
      lines.push(
        '',
        `<b>${index + 1}) ${label}</b>`,
        `🔁 ${pair}`,
        `🌐 ${escapeHtml(preset.chain)}`,
        `💎 ${escapeHtml(preset.defaultAmount ?? 'не указано')}`,
      );
    }

    await context.reply(lines.join('\n'), { parse_mode: 'HTML' });
  }

  public async handlePresetAdd(context: Context, userId: string, data: string): Promise<void> {
    const action = this.sessionStore.consumePendingAction(userId, data);

    if (!action) {
      await context.answerCbQuery('Действие истекло');
      return;
    }

    try {
      const payload = action.payload as unknown as IPresetCreationPayload;
      const preset = await this.tradePresetsService.createPreset({
        userId,
        label: this.generateLabel(userId),
        chain: payload.chain as ChainType,
        sellTokenAddress: payload.fromTokenAddress,
        buyTokenAddress: payload.toTokenAddress,
        defaultAmount: payload.amount,
      });

      await context.answerCbQuery(`Пресет "${preset.label}" создан`);
    } catch (error: unknown) {
      this.logger.error(`Preset add failed: ${String(error)}`);
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
      await context.answerCbQuery(`Ошибка: ${escapeHtml(message)}`);
    }
  }

  public async handlePresetDelete(context: Context, userId: string, data: string): Promise<void> {
    const deleted = await this.tradePresetsService.deletePreset(userId, data);

    if (deleted) {
      await context.answerCbQuery('Пресет удалён');
    } else {
      await context.answerCbQuery('Пресет не найден');
    }
  }

  public async handlePresetSave(
    context: Context,
    userId: string,
    payload: {
      chain: string;
      amount: string;
      fromTokenAddress: string;
      toTokenAddress: string;
    },
  ): Promise<void> {
    try {
      const fromToken = await this.tokensService.getTokenByAddress(
        payload.fromTokenAddress,
        payload.chain as ChainType,
      );
      const toToken = await this.tokensService.getTokenByAddress(
        payload.toTokenAddress,
        payload.chain as ChainType,
      );

      const label = `${fromToken.symbol} → ${toToken.symbol}`;
      await this.tradePresetsService.createPreset({
        userId,
        label,
        chain: payload.chain as ChainType,
        sellTokenAddress: payload.fromTokenAddress,
        buyTokenAddress: payload.toTokenAddress,
        defaultAmount: payload.amount,
      });

      await context.answerCbQuery(`Пресет "${escapeHtml(label)}" создан`);
    } catch (error: unknown) {
      this.logger.error(`Preset save failed: ${String(error)}`);
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
      await context.answerCbQuery(`Ошибка: ${escapeHtml(message)}`);
    }
  }

  public createPresetSaveCallbackData(userId: string, payload: IPresetCreationPayload): string {
    const token = this.createToken();
    this.sessionStore.createPendingAction({
      token,
      userId,
      kind: 'preset-save',
      payload: payload as unknown as Record<string, unknown>,
    });
    return `pst:${token}`;
  }

  public async handlePresetSaveByToken(
    context: Context,
    userId: string,
    token: string,
  ): Promise<void> {
    const action = this.sessionStore.consumePendingAction(userId, token);

    if (!action) {
      await context.answerCbQuery('Действие истекло');
      return;
    }

    const payload = action.payload as unknown as IPresetCreationPayload;
    await this.handlePresetSave(context, userId, payload);
  }

  public createAddCallbackToken(userId: string, payload: IPresetCreationPayload): string {
    const token = this.createToken();
    this.sessionStore.createPendingAction({
      token,
      userId,
      kind: 'preset-add',
      payload: payload as unknown as Record<string, unknown>,
    });
    return `${TEMPLATE_ADD_PREFIX}${token}`;
  }

  public createDeleteCallbackData(presetId: string): string {
    return `${TEMPLATE_DELETE_PREFIX}${presetId}`;
  }

  public isAdd(data: string): boolean {
    return data.startsWith(TEMPLATE_ADD_PREFIX);
  }

  public isDelete(data: string): boolean {
    return data.startsWith(TEMPLATE_DELETE_PREFIX);
  }

  public getAddToken(data: string): string {
    return data.slice(TEMPLATE_ADD_PREFIX.length);
  }

  public getPresetIdFromDelete(data: string): string {
    return data.slice(TEMPLATE_DELETE_PREFIX.length);
  }

  private createToken(): string {
    return randomBytes(CALLBACK_TOKEN_BYTES).toString('base64url');
  }

  private generateLabel(_userId: string): string {
    return `Пресет ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  }
}
