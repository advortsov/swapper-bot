import { describe, expect, it } from 'vitest';

import { BusinessException } from '../../src/common/exceptions/business.exception';
import { TelegramPortfolioParserService } from '../../src/telegram/telegram.portfolio-parser.service';

describe('TelegramPortfolioParserService', () => {
  const service = new TelegramPortfolioParserService();

  it('должен распознавать favorite callback prefixes', () => {
    expect(service.isFavoriteAdd('fav:add:token')).toBe(true);
    expect(service.isFavoriteCheck('fav:check:id')).toBe(true);
    expect(service.isFavoriteAlert('fav:alert:id')).toBe(true);
    expect(service.isFavoriteDelete('fav:del:id')).toBe(true);
  });

  it('должен извлекать payload избранной пары', () => {
    expect(
      service.getFavoriteActionPayload({
        chain: 'ethereum',
        amount: '1',
        fromTokenAddress: '0xfrom',
        toTokenAddress: '0xto',
      }),
    ).toEqual({
      chain: 'ethereum',
      amount: '1',
      fromTokenAddress: '0xfrom',
      toTokenAddress: '0xto',
    });
  });

  it('должен падать на битом payload', () => {
    expect(() => service.getFavoriteActionPayload({ chain: 'ethereum' })).toThrow(
      BusinessException,
    );
  });
});
