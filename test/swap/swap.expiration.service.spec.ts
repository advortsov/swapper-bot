import { describe, expect, it } from 'vitest';

import { SwapExpirationService } from '../../src/swap/swap.expiration.service';

const service = new SwapExpirationService();

describe('SwapExpirationService', () => {
  it('должен использовать дефолтный slippage при невалидном пользовательском значении', () => {
    expect(service.resolveSlippage(0)).toBe(0.5);
    expect(service.resolveSlippage(1.25)).toBe(1.25);
  });

  it('должен форматировать quote expiration в ISO строку', () => {
    expect(service.formatQuoteExpiresAt(new Date('2026-03-02T00:05:00.000Z'))).toBe(
      '2026-03-02T00:05:00.000Z',
    );
  });
});
