import { describe, expect, it, vi } from 'vitest';

import {
  getValidatedOdosPartnerFeePercent,
  validateOdosFeeBreakdown,
} from '../../src/aggregators/odos/odos.quote-validator';
import type { MetricsService } from '../../src/metrics/metrics.service';

describe('odos.quote-validator', () => {
  it('должен возвращать partner fee percent', () => {
    const metricsService: Pick<MetricsService, 'incrementError'> = { incrementError: vi.fn() };
    expect(
      getValidatedOdosPartnerFeePercent(metricsService as MetricsService, {
        partnerFeePercent: 0.2,
      }),
    ).toBe(0.2);
  });

  it('должен падать на невалидный fee breakdown', () => {
    const metricsService: Pick<MetricsService, 'incrementError'> = { incrementError: vi.fn() };
    expect(() => {
      validateOdosFeeBreakdown(metricsService as MetricsService, '10', '11', '-1');
    }).toThrowError('Odos quote fee breakdown is inconsistent');
  });
});
