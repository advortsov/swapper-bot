import { describe, expect, it } from 'vitest';

import { BusinessException } from '../../src/common/exceptions/business.exception';
import { TelegramTradingParserService } from '../../src/telegram/telegram.trading-parser.service';

describe('TelegramTradingParserService', () => {
  const service = new TelegramTradingParserService();

  it('должен разбирать команду /price', () => {
    expect(service.parsePriceCommand('/price 10 ETH to USDC on arbitrum')).toEqual({
      amount: '10',
      fromTokenInput: 'ETH',
      toTokenInput: 'USDC',
      chain: 'arbitrum',
      explicitChain: true,
    });
  });

  it('должен возвращать default chain для /swap без on', () => {
    expect(service.parseSwapCommand('/swap 1 ETH to USDC')).toEqual({
      amount: '1',
      fromTokenInput: 'ETH',
      toTokenInput: 'USDC',
      chain: 'ethereum',
      explicitChain: false,
    });
  });

  it('должен падать на битом approve callback', () => {
    expect(() => service.parseApproveCallback('apr:token:paraswap:broken')).toThrow(
      BusinessException,
    );
  });
});
