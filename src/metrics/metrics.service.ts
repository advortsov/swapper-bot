import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

const BUCKET_0_05 = 0.05;
const BUCKET_0_1 = 0.1;
const BUCKET_0_25 = 0.25;
const BUCKET_0_5 = 0.5;
const BUCKET_1 = 1;
const BUCKET_2 = 2;
const BUCKET_5 = 5;
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
}
