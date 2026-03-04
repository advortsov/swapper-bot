import { describe, expect, it, vi } from 'vitest';

import type { IApproveSessionResponse } from '../../src/allowance/interfaces/allowance.interface';
import type { ISwapSessionResponse } from '../../src/swap/interfaces/swap.interface';
import { TelegramConnectionsService } from '../../src/telegram/telegram.connections.service';

describe('TelegramConnectionsService', () => {
  function createService(): {
    service: TelegramConnectionsService;
    parser: {
      parseConnectChain: ReturnType<typeof vi.fn>;
      parseDisconnectChain: ReturnType<typeof vi.fn>;
      resolveConnectActionChain: ReturnType<typeof vi.fn>;
      resolveDisconnectActionChain: ReturnType<typeof vi.fn>;
      buildConnectionButtons: ReturnType<typeof vi.fn>;
      isConnectAction: ReturnType<typeof vi.fn>;
      isDisconnectAction: ReturnType<typeof vi.fn>;
    };
    reply: {
      replyConnectionStatus: ReturnType<typeof vi.fn>;
      replyAlreadyConnected: ReturnType<typeof vi.fn>;
      replyConnectionSession: ReturnType<typeof vi.fn>;
      replyDisconnectMessage: ReturnType<typeof vi.fn>;
      replySwapSession: ReturnType<typeof vi.fn>;
      replyApproveSession: ReturnType<typeof vi.fn>;
    };
    walletConnectService: {
      getConnectionStatus: ReturnType<typeof vi.fn>;
      connect: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
    };
  } {
    const walletConnectService = {
      getConnectionStatus: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    const parser = {
      parseConnectChain: vi.fn(),
      parseDisconnectChain: vi.fn(),
      resolveConnectActionChain: vi.fn(),
      resolveDisconnectActionChain: vi.fn(),
      buildConnectionButtons: vi.fn(),
      isConnectAction: vi.fn(),
      isDisconnectAction: vi.fn(),
    };
    const reply = {
      replyConnectionStatus: vi.fn().mockResolvedValue(undefined),
      replyAlreadyConnected: vi.fn().mockResolvedValue(undefined),
      replyConnectionSession: vi.fn().mockResolvedValue(undefined),
      replyDisconnectMessage: vi.fn().mockResolvedValue(undefined),
      replySwapSession: vi.fn().mockResolvedValue(undefined),
      replyApproveSession: vi.fn().mockResolvedValue(undefined),
    };
    const service = new TelegramConnectionsService(walletConnectService as never);

    Object.assign(service, {
      telegramConnectionsParserService: parser,
      telegramConnectionsReplyService: reply,
    });

    return {
      service,
      parser,
      reply,
      walletConnectService,
    };
  }

  it('должен делегировать replySwapSession в reply service', async () => {
    const { service, reply } = createService();
    const context = {};
    const session = { chain: 'ethereum' } as ISwapSessionResponse;

    await service.replySwapSession(context as never, session);

    expect(reply.replySwapSession).toHaveBeenCalledWith(context, session);
  });

  it('должен делегировать replyApproveSession в reply service', async () => {
    const { service, reply } = createService();
    const context = {};
    const session = { chain: 'arbitrum' } as IApproveSessionResponse;

    await service.replyApproveSession(context as never, session);

    expect(reply.replyApproveSession).toHaveBeenCalledWith(context, session);
  });

  it('должен показывать статус подключений для /connect без chain', async () => {
    const { service, parser, reply, walletConnectService } = createService();
    const context = {};
    parser.parseConnectChain.mockReturnValue(null);
    walletConnectService.getConnectionStatus.mockReturnValue({ evm: null, solana: null });
    parser.buildConnectionButtons.mockReturnValue([
      [{ text: 'Подключить EVM', callback_data: 'x' }],
    ]);

    await service.handleConnect(context as never, '42', '/connect');

    expect(reply.replyConnectionStatus).toHaveBeenCalled();
  });

  it('должен отключать по /disconnect через parser и reply service', async () => {
    const { service, parser, reply, walletConnectService } = createService();
    const context = {};
    parser.parseDisconnectChain.mockReturnValue('ethereum');

    await service.handleDisconnect(context as never, '42', '/disconnect on ethereum');

    expect(walletConnectService.disconnect).toHaveBeenCalledWith('42', 'ethereum');
    expect(reply.replyDisconnectMessage).toHaveBeenCalledWith(context, 'ethereum');
  });
});
