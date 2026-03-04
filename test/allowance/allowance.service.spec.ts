import { describe, expect, it, vi } from 'vitest';

import { type AllowanceActionService } from '../../src/allowance/allowance-action.service';
import { type AllowanceContextService } from '../../src/allowance/allowance-context.service';
import { type AllowanceGuardService } from '../../src/allowance/allowance-guard.service';
import { type AllowanceTargetService } from '../../src/allowance/allowance-target.service';
import { AllowanceService } from '../../src/allowance/allowance.service';

describe('AllowanceService', () => {
  function createService(): {
    service: AllowanceService;
    allowanceActionService: {
      createOptionsAction: ReturnType<typeof vi.fn>;
      getPreparedApproveExecution: ReturnType<typeof vi.fn>;
    };
    allowanceContextService: {
      resolveApproveContext: ReturnType<typeof vi.fn>;
    };
    allowanceGuardService: {
      ensureSufficientAllowance: ReturnType<typeof vi.fn>;
    };
    allowanceTargetService: {
      resolveApprovalOptions: ReturnType<typeof vi.fn>;
    };
    allowanceTransactionService: {
      buildApproveTransaction: ReturnType<typeof vi.fn>;
      buildApprovalCallbackData: ReturnType<typeof vi.fn>;
    };
  } {
    const allowanceActionService = {
      createOptionsAction: vi.fn(),
      getPreparedApproveExecution: vi.fn(),
    };
    const allowanceContextService = {
      resolveApproveContext: vi.fn(),
    };
    const allowanceGuardService = {
      ensureSufficientAllowance: vi.fn(),
    };
    const allowanceTargetService = {
      resolveApprovalOptions: vi.fn(),
    };
    const allowanceTransactionService = {
      buildApproveTransaction: vi.fn(),
      buildApprovalCallbackData: vi.fn(),
    };
    const service = new AllowanceService(
      allowanceActionService as unknown as AllowanceActionService,
      allowanceContextService as unknown as AllowanceContextService,
      allowanceGuardService as unknown as AllowanceGuardService,
      allowanceTargetService as unknown as AllowanceTargetService,
    );
    Object.assign(service, {
      allowanceTransactionService,
    });

    return {
      service,
      allowanceActionService,
      allowanceContextService,
      allowanceGuardService,
      allowanceTargetService,
      allowanceTransactionService,
    };
  }

  it('должен готовить approve options через выделенные сервисы', async () => {
    const { service, allowanceActionService, allowanceContextService, allowanceTargetService } =
      createService();
    allowanceContextService.resolveApproveContext.mockResolvedValue({
      chain: 'arbitrum',
      tokenSymbol: 'USDC',
      tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      tokenDecimals: 6,
      amount: '10',
      amountBaseUnits: '10000000',
    });
    allowanceTargetService.resolveApprovalOptions.mockResolvedValue([
      {
        aggregatorName: 'paraswap',
        spenderAddress: '0x1111111111111111111111111111111111111111',
        currentAllowance: null,
        currentAllowanceBaseUnits: null,
      },
    ]);
    allowanceActionService.createOptionsAction.mockReturnValue({
      actionToken: 'token',
      chain: 'arbitrum',
      tokenSymbol: 'USDC',
      tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      tokenDecimals: 6,
      amount: '10',
      amountBaseUnits: '10000000',
      walletAddress: null,
      options: [],
    });

    const result = await service.prepareApproveOptions({
      userId: '42',
      amount: '10',
      tokenInput: 'USDC',
      chain: 'arbitrum',
      explicitChain: true,
      walletAddress: null,
    });

    expect(result.actionToken).toBe('token');
    expect(allowanceActionService.createOptionsAction).toHaveBeenCalled();
  });

  it('должен падать если не удалось определить spender', async () => {
    const { service, allowanceContextService, allowanceTargetService } = createService();
    allowanceContextService.resolveApproveContext.mockResolvedValue({
      chain: 'arbitrum',
      tokenSymbol: 'USDC',
      tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      tokenDecimals: 6,
      amount: '10',
      amountBaseUnits: '10000000',
    });
    allowanceTargetService.resolveApprovalOptions.mockResolvedValue([]);

    await expect(
      service.prepareApproveOptions({
        userId: '42',
        amount: '10',
        tokenInput: 'USDC',
        chain: 'arbitrum',
        explicitChain: true,
        walletAddress: null,
      }),
    ).rejects.toThrowError('Не удалось определить spender для arbitrum');
  });

  it('должен делегировать getPreparedApproveExecution в action service', () => {
    const { service, allowanceActionService } = createService();
    allowanceActionService.getPreparedApproveExecution.mockReturnValue({ id: 'x' });

    const result = service.getPreparedApproveExecution('42', 'token', 'paraswap', 'exact');

    expect(result).toEqual({ id: 'x' });
  });

  it('должен делегировать ensureSufficientAllowance в guard service', async () => {
    const { service, allowanceGuardService } = createService();

    await service.ensureSufficientAllowance({
      userId: '42',
      chain: 'arbitrum',
      aggregatorName: 'paraswap',
      walletAddress: '0x000000000000000000000000000000000000dEaD',
      tokenSymbol: 'USDC',
      tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      tokenDecimals: 6,
      buyTokenAddress: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
      amount: '10',
      amountBaseUnits: '10000000',
    });

    expect(allowanceGuardService.ensureSufficientAllowance).toHaveBeenCalled();
  });

  it('должен делегировать построение approve transaction и callback data', () => {
    const { service, allowanceTransactionService } = createService();
    allowanceTransactionService.buildApproveTransaction.mockReturnValue({
      to: '0x1',
      data: '0x2',
      value: '0',
    });
    allowanceTransactionService.buildApprovalCallbackData.mockReturnValue(
      'apr:token:paraswap:exact',
    );

    expect(
      service.buildApproveTransaction({
        chain: 'arbitrum',
        tokenSymbol: 'USDC',
        tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        tokenDecimals: 6,
        spenderAddress: '0x1111111111111111111111111111111111111111',
        aggregatorName: 'paraswap',
        mode: 'exact',
        currentAllowanceBaseUnits: '0',
        amount: '10',
        amountBaseUnits: '10000000',
        approveAmountBaseUnits: '10000000',
      }),
    ).toEqual({ to: '0x1', data: '0x2', value: '0' });
    expect(service.buildApprovalCallbackData('token', 'paraswap', 'exact')).toBe(
      'apr:token:paraswap:exact',
    );
  });

  it('должен собирать WalletConnect approval payload и session response без изменений', () => {
    const { service } = createService();

    const payload = service.toWalletConnectApprovalPayload({
      actionToken: 'token',
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

    expect(payload).toEqual({
      chain: 'arbitrum',
      tokenSymbol: 'USDC',
      tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      tokenDecimals: 6,
      spenderAddress: '0x1111111111111111111111111111111111111111',
      aggregatorName: 'paraswap',
      mode: 'exact',
      currentAllowanceBaseUnits: '1000000',
      amount: '10',
      amountBaseUnits: '10000000',
      approveAmountBaseUnits: '10000000',
    });

    expect(
      service.toApproveSessionResponse({
        prepared: {
          actionToken: 'token',
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
        },
        session: {
          uri: 'wc:test',
          sessionId: 'session-id',
          expiresAt: '2026-03-04T10:00:00.000Z',
          walletDelivery: 'qr',
        },
      }),
    ).toEqual({
      chain: 'arbitrum',
      tokenSymbol: 'USDC',
      tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      aggregatorName: 'paraswap',
      spenderAddress: '0x1111111111111111111111111111111111111111',
      mode: 'exact',
      amount: '10',
      currentAllowance: '1',
      walletConnectUri: 'wc:test',
      sessionId: 'session-id',
      expiresAt: '2026-03-04T10:00:00.000Z',
      walletDelivery: 'qr',
    });
  });
});
