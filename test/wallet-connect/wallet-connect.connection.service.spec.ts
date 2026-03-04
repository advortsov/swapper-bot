import { describe, expect, it, vi } from 'vitest';

import { WalletConnectConnectionService } from '../../src/wallet-connect/wallet-connect.connection.service';

describe('WalletConnectConnectionService', () => {
  it('должен получать reusable session по family mapping', () => {
    const sessionStore = {
      listConnections: vi.fn(),
      touchConnection: vi.fn().mockReturnValue({ address: '0xabc' }),
      getConnection: vi.fn(),
      deleteConnection: vi.fn(),
    };
    const clientService = {
      isEnabled: vi.fn(),
      getClient: vi.fn(),
    };
    const service = new WalletConnectConnectionService(
      clientService as never,
      sessionStore as never,
    );

    const result = service.getReusableSession('42', 'arbitrum');

    expect(sessionStore.touchConnection).toHaveBeenCalledWith('42', 'evm');
    expect(result).toEqual({ address: '0xabc' });
  });

  it('должен удалять обе family при disconnect all', async () => {
    const evmConnection = { topic: 'topic-1' };
    const solanaConnection = { topic: undefined };
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const sessionStore = {
      listConnections: vi.fn(),
      touchConnection: vi.fn(),
      getConnection: vi
        .fn()
        .mockReturnValueOnce(evmConnection)
        .mockReturnValueOnce(solanaConnection),
      deleteConnection: vi.fn(),
    };
    const clientService = {
      isEnabled: vi.fn().mockReturnValue(true),
      getClient: vi.fn().mockResolvedValue({ disconnect }),
    };
    const service = new WalletConnectConnectionService(
      clientService as never,
      sessionStore as never,
    );

    await service.disconnect('42', 'all');

    expect(disconnect).toHaveBeenCalledWith({
      topic: 'topic-1',
      reason: {
        code: 6000,
        message: 'Disconnected by user',
      },
    });
    expect(sessionStore.deleteConnection).toHaveBeenCalledWith('42', 'evm');
    expect(sessionStore.deleteConnection).toHaveBeenCalledWith('42', 'solana');
  });
});
