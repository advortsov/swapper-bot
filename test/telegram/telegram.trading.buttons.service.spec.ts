import { describe, expect, it, vi } from 'vitest';

import type { AllowanceService } from '../../src/allowance/allowance.service';
import { TelegramTradingButtonsService } from '../../src/telegram/telegram.trading-buttons.service';
import { TelegramTradingParserService } from '../../src/telegram/telegram.trading-parser.service';

describe('TelegramTradingButtonsService', () => {
  it('должен собирать swap buttons только для quote с selectionToken', () => {
    const allowanceService = {} as AllowanceService;
    const parser = {
      buildSwapCallbackData: vi.fn().mockImplementation((token: string) => `sw:${token}`),
    } as unknown as TelegramTradingParserService;
    const service = new TelegramTradingButtonsService(allowanceService, parser);

    const buttons = service.buildSwapButtons(
      [
        {
          aggregator: 'paraswap',
          toAmount: '100',
          grossToAmount: '101',
          feeAmount: '1',
          feeAmountSymbol: 'USDC',
          feeBps: 20,
          feeMode: 'enforced',
          feeType: 'partner fee',
          feeDisplayLabel: 'partner fee',
          feeAppliedAtQuote: true,
          feeEnforcedOnExecution: true,
          estimatedGasUsd: 1,
          selectionToken: 'token-1',
        },
        {
          aggregator: 'odos',
          toAmount: '99',
          grossToAmount: '99',
          feeAmount: '0',
          feeAmountSymbol: null,
          feeBps: 0,
          feeMode: 'disabled',
          feeType: 'no fee',
          feeDisplayLabel: 'no fee',
          feeAppliedAtQuote: false,
          feeEnforcedOnExecution: false,
          estimatedGasUsd: null,
        },
      ],
      'USDC',
      'paraswap',
    );

    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.[0]?.callback_data).toBe('sw:token-1');
  });

  it('должен собирать approve buttons для exact и max', () => {
    const allowanceService = {
      buildApprovalCallbackData: vi
        .fn()
        .mockImplementation((actionToken: string, aggregatorName: string, mode: string) => {
          return `apr:${actionToken}:${aggregatorName}:${mode}`;
        }),
    } as unknown as AllowanceService;
    const parser = new TelegramTradingParserService();
    const service = new TelegramTradingButtonsService(allowanceService, parser);

    const buttons = service.buildApproveButtons('action-1', [
      {
        aggregatorName: 'paraswap',
        spenderAddress: '0xspender',
        currentAllowance: null,
        currentAllowanceBaseUnits: null,
      },
    ]);

    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.[0]?.callback_data).toBe('apr:action-1:paraswap:exact');
    expect(buttons[1]?.[0]?.callback_data).toBe('apr:action-1:paraswap:max');
  });
});
