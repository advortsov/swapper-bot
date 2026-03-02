import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PriceAlertsService } from './price-alerts.service';
import { PriceQuoteService } from '../price/price.quote.service';
import { TELEGRAM_API_BASE_URL } from '../wallet-connect/wallet-connect.constants';

const DEFAULT_POLL_INTERVAL_SECONDS = 60;
const MIN_POLL_INTERVAL_SECONDS = 10;
const ALERT_BATCH_SIZE = 50;

@Injectable()
export class PriceAlertsWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PriceAlertsWorker.name);
  private readonly pollIntervalMs: number;
  private readonly telegramBotToken: string;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  public constructor(
    private readonly configService: ConfigService,
    private readonly priceAlertsService: PriceAlertsService,
    private readonly priceQuoteService: PriceQuoteService,
  ) {
    this.pollIntervalMs = this.resolvePollIntervalMs();
    this.telegramBotToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
  }

  public onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.runTick();
    }, this.pollIntervalMs);
  }

  public onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async runTick(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      const alerts = await this.priceAlertsService.listActiveBatch(ALERT_BATCH_SIZE);

      for (const alert of alerts) {
        await this.processAlert(alert);
      }
    } finally {
      this.running = false;
    }
  }

  private async processAlert(
    alert: Awaited<ReturnType<PriceAlertsService['listActiveBatch']>>[number],
  ): Promise<void> {
    try {
      const prepared = await this.priceQuoteService.prepare({
        userId: alert.userId,
        chain: alert.chain,
        amount: alert.amount,
        fromTokenInput: alert.fromTokenAddress,
        toTokenInput: alert.toTokenAddress,
        rawCommand: `/favorites ${alert.amount} ${alert.fromTokenSymbol} to ${alert.toTokenSymbol}`,
        explicitChain: true,
      });
      const selection = await this.priceQuoteService.fetchQuoteSelection(prepared);
      const response = this.priceQuoteService.buildResponse(prepared, selection);

      await this.priceAlertsService.markObserved(alert.id, response.toAmount, response.aggregator);

      if (Number.parseFloat(response.toAmount) < Number.parseFloat(alert.targetToAmount)) {
        return;
      }

      await this.priceAlertsService.markTriggered(alert.id, response.toAmount, response.aggregator);
      await this.sendTelegramMessage(
        alert.userId,
        [
          'Сработал алерт по курсу.',
          `Сеть: ${alert.chain}`,
          `Пара: ${alert.amount} ${alert.fromTokenSymbol} -> ${alert.toTokenSymbol}`,
          `Цель: ${alert.targetToAmount} ${alert.toTokenSymbol}`,
          `Текущий net: ${response.toAmount} ${alert.toTokenSymbol}`,
          `Лучший агрегатор: ${response.aggregator}`,
        ].join('\n'),
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Alert ${alert.id} check failed: ${message}`);
    }
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
          disable_web_page_preview: true,
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      this.logger.warn(`Telegram alert send failed: ${response.status} ${body}`);
    }
  }

  private resolvePollIntervalMs(): number {
    const rawValue = this.configService.get<string>('PRICE_ALERTS_POLL_INTERVAL_SEC');
    const parsed = Number.parseInt(rawValue ?? `${DEFAULT_POLL_INTERVAL_SECONDS}`, 10);
    const seconds =
      !Number.isInteger(parsed) || parsed < MIN_POLL_INTERVAL_SECONDS
        ? DEFAULT_POLL_INTERVAL_SECONDS
        : parsed;

    return seconds * 1_000;
  }
}
