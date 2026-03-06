import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { TransactionStatusService } from './transaction-status.service';
import type { ChainType } from '../chains/interfaces/chain.interface';
import { SwapExecutionsRepository } from '../database/repositories/swap-executions.repository';
import { TrackedTransactionsRepository } from '../database/repositories/tracked-transactions.repository';
import type { ITrackedTransactionRecord } from '../database/repositories/tracked-transactions.repository';
import { MetricsService } from '../metrics/metrics.service';
import {
  buildTransactionConfirmedMessage,
  buildTransactionFailedMessage,
} from '../telegram/telegram.message-formatters';
import { TELEGRAM_API_BASE_URL } from '../wallet-connect/wallet-connect.constants';

const DEFAULT_POLL_INTERVAL_SECONDS = 15;
const MIN_POLL_INTERVAL_SECONDS = 5;
const DEFAULT_TIMEOUT_SECONDS = 600;
const PENDING_BATCH_SIZE = 100;
const MS_PER_SECOND = 1_000;

@Injectable()
export class TransactionTrackerWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TransactionTrackerWorker.name);
  private readonly pollIntervalMs: number;
  private readonly timeoutMs: number;
  private readonly telegramBotToken: string;
  private readonly enabled: boolean;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  @Inject()
  private readonly metricsService!: MetricsService;

  public constructor(
    private readonly configService: ConfigService,
    private readonly trackedTransactionsRepository: TrackedTransactionsRepository,
    private readonly swapExecutionsRepository: SwapExecutionsRepository,
    private readonly transactionStatusService: TransactionStatusService,
  ) {
    this.enabled =
      (this.configService.get<string>('TX_TRACKING_ENABLED') ?? 'true').toLowerCase() === 'true';
    this.pollIntervalMs = this.resolvePollIntervalMs();
    this.timeoutMs = this.resolveTimeoutMs();
    this.telegramBotToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
  }

  public onModuleInit(): void {
    if (!this.enabled) {
      this.logger.log('Transaction tracking is disabled');
      return;
    }

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
      const pending = await this.trackedTransactionsRepository.listPending(PENDING_BATCH_SIZE);

      this.metricsService.setTrackedTransactionsPending(pending.length);

      for (const tx of pending) {
        await this.processTransaction(tx);
      }
    } finally {
      this.running = false;
    }
  }

  private async processTransaction(tx: ITrackedTransactionRecord): Promise<void> {
    try {
      const receipt = await this.transactionStatusService.checkStatus(
        tx.chain as ChainType,
        tx.hash,
      );

      if (receipt) {
        if (receipt.status === 'confirmed') {
          await this.handleConfirmed(tx, receipt);
        } else {
          await this.handleFailed(tx, 'Transaction reverted');
        }

        return;
      }

      const elapsed = Date.now() - tx.submittedAt.getTime();

      if (elapsed > this.timeoutMs) {
        await this.handleFailed(tx, 'Transaction confirmation timed out');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to check transaction ${tx.hash} on ${tx.chain}: ${message}`);
    }
  }

  private async handleConfirmed(
    tx: ITrackedTransactionRecord,
    receipt: {
      blockNumber: bigint | null;
      gasUsed: string | null;
      effectiveGasPrice: string | null;
    },
  ): Promise<void> {
    const confirmedAt = new Date();

    await this.trackedTransactionsRepository.markConfirmed(tx.chain, tx.hash, {
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      effectiveGasPrice: receipt.effectiveGasPrice,
    });

    await this.swapExecutionsRepository.updateTransactionStatus(tx.executionId, {
      transactionStatus: 'confirmed',
      confirmedAt,
      gasUsed: receipt.gasUsed,
      effectiveGasPrice: receipt.effectiveGasPrice,
    });

    this.metricsService.incrementTrackedTransaction(tx.chain, 'confirmed');

    const latencySeconds = (confirmedAt.getTime() - tx.submittedAt.getTime()) / MS_PER_SECOND;
    this.metricsService.observeTransactionConfirmationLatency(tx.chain, latencySeconds);

    await this.sendTelegramMessage(
      tx.userId,
      buildTransactionConfirmedMessage({
        chain: tx.chain as ChainType,
        hash: tx.hash,
        blockNumber: receipt.blockNumber !== null ? receipt.blockNumber.toString() : null,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice,
      }),
    );
  }

  private async handleFailed(tx: ITrackedTransactionRecord, errorMessage: string): Promise<void> {
    await this.trackedTransactionsRepository.markFailed(tx.chain, tx.hash, errorMessage);

    await this.swapExecutionsRepository.updateTransactionStatus(tx.executionId, {
      transactionStatus: 'failed',
    });

    this.metricsService.incrementTrackedTransaction(tx.chain, 'failed');

    await this.sendTelegramMessage(
      tx.userId,
      buildTransactionFailedMessage({
        chain: tx.chain as ChainType,
        hash: tx.hash,
        errorMessage,
      }),
    );
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
      this.logger.warn(`Telegram tx tracking send failed: ${response.status} ${body}`);
    }
  }

  private resolvePollIntervalMs(): number {
    const rawValue = this.configService.get<string>('TX_TRACKING_POLL_INTERVAL_SEC');
    const parsed = Number.parseInt(rawValue ?? `${DEFAULT_POLL_INTERVAL_SECONDS}`, 10);
    const seconds =
      !Number.isInteger(parsed) || parsed < MIN_POLL_INTERVAL_SECONDS
        ? DEFAULT_POLL_INTERVAL_SECONDS
        : parsed;

    return seconds * MS_PER_SECOND;
  }

  private resolveTimeoutMs(): number {
    const rawValue = this.configService.get<string>('TX_TRACKING_TIMEOUT_SEC');
    const parsed = Number.parseInt(rawValue ?? `${DEFAULT_TIMEOUT_SECONDS}`, 10);
    const seconds = !Number.isInteger(parsed) || parsed < 60 ? DEFAULT_TIMEOUT_SECONDS : parsed;

    return seconds * MS_PER_SECOND;
  }
}
