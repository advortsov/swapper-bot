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
  private readonly errorsCounter: Counter<'type'>;
  private readonly httpRequestsCounter: Counter<'provider' | 'method' | 'status_code'>;
  private readonly httpRequestDuration: Histogram<'provider' | 'method' | 'status_code'>;

  public constructor(configService: ConfigService) {
    this.enabled =
      (configService.get<string>('METRICS_ENABLED') ?? 'true').toLowerCase() === 'true';

    this.registry = new Registry();

    collectDefaultMetrics({
      register: this.registry,
    });

    this.priceRequestsCounter = new Counter({
      name: 'price_requests_total',
      help: 'Total number of /price requests',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.errorsCounter = new Counter({
      name: 'errors_total',
      help: 'Total errors by type',
      labelNames: ['type'],
      registers: [this.registry],
    });

    this.httpRequestsCounter = new Counter({
      name: 'http_requests_total',
      help: 'External API requests',
      labelNames: ['provider', 'method', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'External API request duration',
      labelNames: ['provider', 'method', 'status_code'],
      registers: [this.registry],
      buckets: [BUCKET_0_05, BUCKET_0_1, BUCKET_0_25, BUCKET_0_5, BUCKET_1, BUCKET_2, BUCKET_5],
    });
  }

  public incrementPriceRequest(status: 'success' | 'error'): void {
    if (!this.enabled) {
      return;
    }

    this.priceRequestsCounter.inc({ status });
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

  public async getMetrics(): Promise<string> {
    if (!this.enabled) {
      return '# metrics are disabled\n';
    }

    return this.registry.metrics();
  }
}
