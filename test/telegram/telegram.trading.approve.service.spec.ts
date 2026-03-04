import { describe, expect, it, vi } from 'vitest';

import type { AllowanceService } from '../../src/allowance/allowance.service';
import { type TelegramConnectionsService } from '../../src/telegram/telegram.connections.service';
import { TelegramTradingApproveService } from '../../src/telegram/telegram.trading-approve.service';
import type { TelegramTradingButtonsService } from '../../src/telegram/telegram.trading-buttons.service';
import type { IApproveCallbackPayload } from '../../src/telegram/telegram.trading-parser.service';
import type { WalletConnectService } from '../../src/wallet-connect/wallet-connect.service';

describe('TelegramTradingApproveService', () => {
  it('должен собирать approve options и отвечать с кнопками', async () => {
    const walletConnectService = {
      getReusableSession: vi.fn().mockReturnValue({ address: '0xwallet' }),
    } as unknown as WalletConnectService;
    const allowanceService = {
      prepareApproveOptions: vi.fn().mockResolvedValue({
        actionToken: 'action-1',
        chain: 'arbitrum',
        tokenSymbol: 'USDC',
        tokenAddress: '0xtoken',
        tokenDecimals: 6,
        amount: '10',
        amountBaseUnits: '10000000',
        walletAddress: '0xwallet',
        options: [
          {
            aggregatorName: 'paraswap',
            spenderAddress: '0xspender',
            currentAllowance: '0',
            currentAllowanceBaseUnits: '0',
          },
        ],
      }),
    } as unknown as AllowanceService;
    const buttonsService = {
      buildApproveButtons: vi.fn().mockReturnValue([[{ text: 'x', callback_data: 'y' }]]),
    } as unknown as TelegramTradingButtonsService;
    const service = new TelegramTradingApproveService(
      walletConnectService,
      allowanceService,
      buttonsService,
    );
    const reply = vi.fn().mockResolvedValue(undefined);

    await service.handleApprove({ reply } as never, '42', {
      amount: '10',
      tokenInput: 'USDC',
      chain: 'arbitrum',
      explicitChain: true,
    });

    expect(allowanceService.prepareApproveOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '42',
        walletAddress: '0xwallet',
      }),
    );
    expect(reply).toHaveBeenCalled();
  });

  it('должен делегировать approve callback в wallet connect и connections reply', async () => {
    const walletConnectService = {
      createApproveSession: vi.fn().mockResolvedValue({ sessionId: 'session-1' }),
    } as unknown as WalletConnectService;
    const allowanceService = {
      getPreparedApproveExecution: vi.fn().mockReturnValue({ prepared: true }),
      toWalletConnectApprovalPayload: vi.fn().mockReturnValue({ payload: true }),
      toApproveSessionResponse: vi.fn().mockReturnValue({ response: true }),
    } as unknown as AllowanceService;
    const buttonsService = {} as TelegramTradingButtonsService;
    const connectionsService = {
      replyApproveSession: vi.fn().mockResolvedValue(undefined),
    } as unknown as TelegramConnectionsService;
    const service = new TelegramTradingApproveService(
      walletConnectService,
      allowanceService,
      buttonsService,
    );
    const answerCbQuery = vi.fn().mockResolvedValue(undefined);
    const payload: IApproveCallbackPayload = {
      actionToken: 'action-1',
      aggregatorName: 'paraswap',
      mode: 'exact',
    };

    await service.handleApproveCallback(
      { answerCbQuery } as never,
      '42',
      payload,
      connectionsService,
    );

    expect(answerCbQuery).toHaveBeenCalledWith('Подготовка approve...');
    expect(walletConnectService.createApproveSession).toHaveBeenCalled();
    expect(connectionsService.replyApproveSession).toHaveBeenCalled();
  });
});
