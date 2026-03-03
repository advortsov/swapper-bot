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

  it('должен срабатывать при пересечении порога вверх', () => {
    const service = new PriceAlertsService(
      { get: vi.fn().mockReturnValue('20') } as never,
      {} as never,
      {} as never,
    );

    expect(
      service.shouldTriggerOnCrossing(
        {
          targetToAmount: '200',
          lastObservedNetToAmount: '190',
        },
        '205',
      ),
    ).toBe(true);
  });

  it('должен срабатывать при пересечении порога вниз', () => {
    const service = new PriceAlertsService(
      { get: vi.fn().mockReturnValue('20') } as never,
      {} as never,
      {} as never,
    );

    expect(
      service.shouldTriggerOnCrossing(
        {
          targetToAmount: '200',
          lastObservedNetToAmount: '210',
        },
        '195',
      ),
    ).toBe(true);
  });

  it('не должен срабатывать на первом наблюдении без предыдущей цены', () => {
    const service = new PriceAlertsService(
      { get: vi.fn().mockReturnValue('20') } as never,
      {} as never,
      {} as never,
    );

    expect(
      service.shouldTriggerOnCrossing(
        {
          targetToAmount: '200',
          lastObservedNetToAmount: null,
        },
        '205',
      ),
    ).toBe(false);
  });

  it('не должен срабатывать если цена осталась по ту же сторону порога снизу', () => {
    const service = new PriceAlertsService(
      { get: vi.fn().mockReturnValue('20') } as never,
      {} as never,
      {} as never,
    );

    expect(
      service.shouldTriggerOnCrossing(
        {
          targetToAmount: '200',
          lastObservedNetToAmount: '190',
        },
        '195',
      ),
    ).toBe(false);
  });

  it('не должен срабатывать если цена осталась по ту же сторону порога сверху', () => {
    const service = new PriceAlertsService(
      { get: vi.fn().mockReturnValue('20') } as never,
      {} as never,
      {} as never,
    );

    expect(
      service.shouldTriggerOnCrossing(
        {
          targetToAmount: '200',
          lastObservedNetToAmount: '210',
        },
        '205',
      ),
    ).toBe(false);
  });
});
