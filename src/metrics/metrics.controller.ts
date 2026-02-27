import { Controller, Get, Header } from '@nestjs/common';

import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  public constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  public async getMetrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }
}
