import { describe, expect, it, vi } from 'vitest';

import { PriceAlertsService } from '../../src/alerts/price-alerts.service';
import { BusinessException } from '../../src/common/exceptions/business.exception';

describe('PriceAlertsService', () => {
  it('должен создавать или обновлять активный алерт', async () => {
    const service = new PriceAlertsService(
      { get: vi.fn().mockReturnValue('20') } as never,
      {
        findActiveByFavorite: vi.fn().mockResolvedValue(null),
        countActiveByUser: vi.fn().mockResolvedValue(0),
        upsertActiveAlert: vi.fn().mockResolvedValue({ id: 'alert-1', targetToAmount: '200' }),
      } as never,
      {
        getFavorite: vi.fn().mockResolvedValue({ id: 'fav-1' }),
      } as never,
    );

    const result = await service.upsertAlert('42', 'fav-1', '200');

    expect(result.id).toBe('alert-1');
  });

  it('должен ограничивать число активных алертов на пользователя', async () => {
    const service = new PriceAlertsService(
      { get: vi.fn().mockReturnValue('1') } as never,
      {
        findActiveByFavorite: vi.fn().mockResolvedValue(null),
        countActiveByUser: vi.fn().mockResolvedValue(1),
        upsertActiveAlert: vi.fn(),
      } as never,
      {
        getFavorite: vi.fn().mockResolvedValue({ id: 'fav-1' }),
      } as never,
    );

    await expect(service.upsertAlert('42', 'fav-1', '200')).rejects.toThrowError(BusinessException);
  });
});
