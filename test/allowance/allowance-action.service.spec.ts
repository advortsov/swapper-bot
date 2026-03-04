import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import { AllowanceActionService } from '../../src/allowance/allowance-action.service';
import { WalletConnectSessionStore } from '../../src/wallet-connect/wallet-connect.session-store';

describe('AllowanceActionService', () => {
  function createStore(): WalletConnectSessionStore {
    const configService = {
      get: () => undefined,
    } as unknown as ConfigService;

    return new WalletConnectSessionStore(configService);
  }

  it('должен создавать approve action и возвращать публичный ответ', () => {
    const store = createStore();
    const service = new AllowanceActionService(store);

    const result = service.createOptionsAction({
      userId: '42',
      walletAddress: null,
      context: {
        chain: 'arbitrum',
        tokenSymbol: 'USDC',
        tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        tokenDecimals: 6,
        amount: '10',
        amountBaseUnits: '10000000',
      },
      options: [
        {
          aggregatorName: 'paraswap',
          spenderAddress: '0x1111111111111111111111111111111111111111',
          currentAllowance: null,
          currentAllowanceBaseUnits: null,
        },
      ],
    });

    expect(result.options).toHaveLength(1);
    expect(store.getPendingAction(result.actionToken)?.userId).toBe('42');
  });

  it('должен возвращать prepared approve execution', () => {
    const store = createStore();
    const service = new AllowanceActionService(store);
    const result = service.createOptionsAction({
      userId: '42',
      walletAddress: '0x000000000000000000000000000000000000dEaD',
      context: {
        chain: 'arbitrum',
        tokenSymbol: 'USDC',
        tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        tokenDecimals: 6,
        amount: '10',
        amountBaseUnits: '10000000',
      },
      options: [
        {
          aggregatorName: 'paraswap',
          spenderAddress: '0x1111111111111111111111111111111111111111',
          currentAllowance: '1',
          currentAllowanceBaseUnits: '1000000',
        },
      ],
    });

    const prepared = service.getPreparedApproveExecution(
      '42',
      result.actionToken,
      'paraswap',
      'exact',
    );

    expect(prepared).toEqual({
      actionToken: result.actionToken,
      chain: 'arbitrum',
      tokenSymbol: 'USDC',
      tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      tokenDecimals: 6,
      amount: '10',
      amountBaseUnits: '10000000',
      currentAllowance: '1',
      currentAllowanceBaseUnits: '1000000',
      aggregatorName: 'paraswap',
      spenderAddress: '0x1111111111111111111111111111111111111111',
      mode: 'exact',
      approveAmountBaseUnits: '10000000',
    });
  });

  it('должен падать для чужого пользователя', () => {
    const store = createStore();
    const service = new AllowanceActionService(store);
    const result = service.createOptionsAction({
      userId: '42',
      walletAddress: null,
      context: {
        chain: 'arbitrum',
        tokenSymbol: 'USDC',
        tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        tokenDecimals: 6,
        amount: '10',
        amountBaseUnits: '10000000',
      },
      options: [],
    });

    expect(() =>
      service.getPreparedApproveExecution('24', result.actionToken, 'paraswap', 'exact'),
    ).toThrowError('Approve-сессия не найдена или истекла');
  });
});
