import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AssetAlertsService } from './asset-alerts.service';
import { PriceAlertsService } from './price-alerts.service';
import { PriceQuoteService } from '../price/price.quote.service';
import { buildAlertTriggeredMessage } from '../telegram/telegram.message-formatters';
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
    private readonly assetAlertsService: AssetAlertsService,
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

      const assetAlerts = await this.assetAlertsService.listActiveAssetAlerts(ALERT_BATCH_SIZE);

      for (const alert of assetAlerts) {
        await this.processAssetAlert(alert);
      }
    } finally {
      this.running = false;
    }
  }

  private async processAlert(
    alert: Awaited<ReturnType<PriceAlertsService['listActiveBatch']>>[number],
  ): Promise<void> {
    try {
      // Check quiet hours
      if (
        alert.quietHoursStart &&
        alert.quietHoursEnd &&
        this.priceAlertsService.isInQuietHours(alert.quietHoursStart, alert.quietHoursEnd)
      ) {
        return;
      }

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

      let shouldTrigger = false;

      // Check based on alert kind
      if (alert.kind === 'fixed') {
        shouldTrigger = this.priceAlertsService.shouldTriggerOnCrossing(alert, response.toAmount);
      } else if (alert.kind === 'percentage' && alert.percentageChange) {
        shouldTrigger = this.priceAlertsService.shouldTriggerPercentage(alert, response.toAmount);
      }

      // Check direction alerts
      if (alert.direction && !shouldTrigger) {
        shouldTrigger = this.priceAlertsService.shouldTriggerDirection(alert, response.toAmount);
      }

      await this.priceAlertsService.markObserved(alert.id, response.toAmount, response.aggregator);

      if (!shouldTrigger) {
        return;
      }

      await this.priceAlertsService.markTriggered(alert.id, response.toAmount, response.aggregator);
      await this.sendTelegramMessage(
        alert.userId,
        buildAlertTriggeredMessage({
          chain: alert.chain,
          amount: alert.amount,
          fromTokenSymbol: alert.fromTokenSymbol,
          toTokenSymbol: alert.toTokenSymbol,
          targetToAmount: alert.targetToAmount ?? 'N/A',
          currentToAmount: response.toAmount,
          aggregator: response.aggregator,
        }),
      );

      // Reset repeatable alert
      if (alert.repeatable) {
        await this.priceAlertsService.resetRepeatableAlert(alert.id);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Alert ${alert.id} check failed: ${message}`);
    }
  }

  private async processAssetAlert(
    alert: Awaited<ReturnType<AssetAlertsService['listActiveAssetAlerts']>>[number],
  ): Promise<void> {
    try {
      // Check quiet hours
      if (
        alert.quietHoursStart &&
        alert.quietHoursEnd &&
        this.assetAlertsService.isInQuietHours(alert.quietHoursStart, alert.quietHoursEnd)
      ) {
        return;
      }

      // For asset alerts, we need to fetch price somehow
      // This is a simplified implementation - in production, you'd use a price oracle
      // For now, we'll skip asset alert processing as it requires price fetching infrastructure

      // TODO: Implement price fetching for asset alerts
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Asset alert ${alert.id} check failed: ${message}`);
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
          parse_mode: 'HTML',
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
