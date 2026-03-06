import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

const BUCKET_0_05 = 0.05;
const BUCKET_0_1 = 0.1;
const BUCKET_0_25 = 0.25;
const BUCKET_0_5 = 0.5;
const BUCKET_1 = 1;
const BUCKET_2 = 2;
const BUCKET_5 = 5;
const BUCKET_10 = 10;
const BUCKET_30 = 30;
const BUCKET_60 = 60;
const BUCKET_120 = 120;
const BUCKET_300 = 300;
const BUCKET_600 = 600;
const DECIMAL_BASE = 10;

export interface IExternalRequestMetric {
  provider: string;
  method: string;
  statusCode: string;
  durationSeconds: number;
}

@Injectable()
export class MetricsService {
  private readonly enabled: boolean;
  private readonly registry: Registry;
  private readonly priceRequestsCounter: Counter<'status'>;
  private readonly swapRequestsCounter: Counter<'status'>;
  private readonly errorsCounter: Counter<'type'>;
  private readonly httpRequestsCounter: Counter<'provider' | 'method' | 'status_code'>;
  private readonly httpRequestDuration: Histogram<'provider' | 'method' | 'status_code'>;
  private readonly swapFeeQuotesCounter: Counter<'aggregator' | 'fee_mode'>;
  private readonly swapFeeExecutionsCounter: Counter<'aggregator' | 'fee_mode' | 'status'>;
  private readonly swapFeeExpectedAmountCounter: Counter<'aggregator' | 'token'>;
  private readonly swapFeeMissingConfigurationCounter: Counter<'aggregator' | 'chain'>;
  private readonly swapIntentInvalidCallbackCounter: Counter;
  private readonly swapIntentExpiredCounter: Counter;
  private readonly trackedTransactionsCounter: Counter<'chain' | 'status'>;
  private readonly trackedTransactionsPendingGauge: Gauge;
  private readonly transactionConfirmationLatency: Histogram<'chain'>;

  public constructor(configService: ConfigService) {
    this.enabled =
      (configService.get<string>('METRICS_ENABLED') ?? 'true').toLowerCase() === 'true';

    this.registry = new Registry();

    collectDefaultMetrics({
      register: this.registry,
    });

    this.priceRequestsCounter = this.createCounter(
      'price_requests_total',
      'Total number of /price requests',
      ['status'],
    );
    this.swapRequestsCounter = this.createCounter(
      'swap_requests_total',
      'Total number of /swap requests',
      ['status'],
    );
    this.errorsCounter = this.createCounter('errors_total', 'Total errors by type', ['type']);
    this.httpRequestsCounter = this.createCounter('http_requests_total', 'External API requests', [
      'provider',
      'method',
      'status_code',
    ]);
    this.httpRequestDuration = this.createHttpDurationHistogram();
    this.swapFeeQuotesCounter = this.createCounter(
      'swap_fee_quotes_total',
      'Total monetized swap quotes',
      ['aggregator', 'fee_mode'],
    );
    this.swapFeeExecutionsCounter = this.createCounter(
      'swap_fee_executions_total',
      'Total monetized swap executions',
      ['aggregator', 'fee_mode', 'status'],
    );
    this.swapFeeExpectedAmountCounter = this.createCounter(
      'swap_fee_expected_amount_total',
      'Expected fee amount by aggregator and token',
      ['aggregator', 'token'],
    );
    this.swapFeeMissingConfigurationCounter = this.createCounter(
      'swap_fee_missing_configuration_total',
      'Total fee-eligible quotes without required configuration',
      ['aggregator', 'chain'],
    );
    this.swapIntentInvalidCallbackCounter = this.createCounter(
      'swap_intent_invalid_callback_total',
      'Total invalid swap selection callbacks',
      [],
    );
    this.swapIntentExpiredCounter = this.createCounter(
      'swap_intent_expired_total',
      'Total expired swap intents',
      [],
    );
    this.trackedTransactionsCounter = this.createCounter(
      'tracked_transactions_total',
      'Total tracked transactions',
      ['chain', 'status'],
    );
    this.trackedTransactionsPendingGauge = this.createTrackedTransactionsPendingGauge();
    this.transactionConfirmationLatency = this.createTransactionConfirmationLatencyHistogram();
  }

  public incrementPriceRequest(status: 'success' | 'error'): void {
    if (!this.enabled) {
      return;
    }

    this.priceRequestsCounter.inc({ status });
  }

  public incrementSwapRequest(status: 'initiated' | 'success' | 'error'): void {
    if (!this.enabled) {
      return;
    }

    this.swapRequestsCounter.inc({ status });
  }

  public incrementError(type: string): void {
    if (!this.enabled) {
      return;
    }

    this.errorsCounter.inc({ type });
  }

  public observeExternalRequest(metric: IExternalRequestMetric): void {
    if (!this.enabled) {
      return;
    }

    this.httpRequestsCounter.inc({
      provider: metric.provider,
      method: metric.method,
      status_code: metric.statusCode,
    });

    this.httpRequestDuration.observe(
      {
        provider: metric.provider,
        method: metric.method,
        status_code: metric.statusCode,
      },
      metric.durationSeconds,
    );
  }

  public incrementSwapFeeQuote(aggregator: string, feeMode: string): void {
    if (!this.enabled) {
      return;
    }

    this.swapFeeQuotesCounter.inc({ aggregator, fee_mode: feeMode });
  }

  public incrementSwapFeeExecution(aggregator: string, feeMode: string, status: string): void {
    if (!this.enabled) {
      return;
    }

    this.swapFeeExecutionsCounter.inc({ aggregator, fee_mode: feeMode, status });
  }

  public addExpectedFeeAmount(
    aggregator: string,
    token: string,
    amountBaseUnits: string,
    decimals: number | null,
  ): void {
    if (!this.enabled || decimals === null) {
      return;
    }

    const normalizedAmount = Number.parseFloat(amountBaseUnits) / DECIMAL_BASE ** decimals;

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return;
    }

    this.swapFeeExpectedAmountCounter.inc({ aggregator, token }, normalizedAmount);
  }

  public incrementSwapFeeMissingConfiguration(aggregator: string, chain: string): void {
    if (!this.enabled) {
      return;
    }

    this.swapFeeMissingConfigurationCounter.inc({ aggregator, chain });
  }

  public incrementSwapIntentInvalidCallback(): void {
    if (!this.enabled) {
      return;
    }

    this.swapIntentInvalidCallbackCounter.inc();
  }

  public incrementSwapIntentExpired(): void {
    if (!this.enabled) {
      return;
    }

    this.swapIntentExpiredCounter.inc();
  }

  public incrementTrackedTransaction(chain: string, status: string): void {
    if (!this.enabled) {
      return;
    }

    this.trackedTransactionsCounter.inc({ chain, status });
  }

  public setTrackedTransactionsPending(count: number): void {
    if (!this.enabled) {
      return;
    }

    this.trackedTransactionsPendingGauge.set(count);
  }

  public observeTransactionConfirmationLatency(chain: string, seconds: number): void {
    if (!this.enabled) {
      return;
    }

    this.transactionConfirmationLatency.observe({ chain }, seconds);
  }

  public async getMetrics(): Promise<string> {
    if (!this.enabled) {
      return '# metrics are disabled\n';
    }

    return this.registry.metrics();
  }

  private createCounter<T extends string>(
    name: string,
    help: string,
    labelNames: readonly T[],
  ): Counter<T> {
    return new Counter({
      name,
      help,
      labelNames: [...labelNames],
      registers: [this.registry],
    });
  }

  private createHttpDurationHistogram(): Histogram<'provider' | 'method' | 'status_code'> {
    return new Histogram({
      name: 'http_request_duration_seconds',
      help: 'External API request duration',
      labelNames: ['provider', 'method', 'status_code'],
      registers: [this.registry],
      buckets: [BUCKET_0_05, BUCKET_0_1, BUCKET_0_25, BUCKET_0_5, BUCKET_1, BUCKET_2, BUCKET_5],
    });
  }

  private createTrackedTransactionsPendingGauge(): Gauge {
    return new Gauge({
      name: 'tracked_transactions_pending',
      help: 'Current number of pending tracked transactions',
      registers: [this.registry],
    });
  }

  private createTransactionConfirmationLatencyHistogram(): Histogram<'chain'> {
    return new Histogram({
      name: 'transaction_confirmation_latency_seconds',
      help: 'Time from submission to confirmation',
      labelNames: ['chain'],
      registers: [this.registry],
      buckets: [
        BUCKET_1,
        BUCKET_2,
        BUCKET_5,
        BUCKET_10,
        BUCKET_30,
        BUCKET_60,
        BUCKET_120,
        BUCKET_300,
        BUCKET_600,
      ],
    });
  }
}
