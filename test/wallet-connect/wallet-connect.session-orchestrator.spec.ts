import { describe, expect, it, vi } from 'vitest';

import { WalletConnectSessionOrchestrator } from '../../src/wallet-connect/wallet-connect.session-orchestrator';

vi.mock('../../src/wallet-connect/wallet-connect.session-factory', () => ({
  createWalletConnectSessionRecord: vi.fn().mockResolvedValue({
    approval: vi.fn(),
    publicSession: { sessionId: 'session-1', walletDelivery: 'qr' },
    session: { sessionId: 'session-1' },
  }),
}));

describe('WalletConnectSessionOrchestrator', () => {
  it('должен сохранять session, регистрировать approval и запускать lifecycle', async () => {
    const approvalRegistry = {
      set: vi.fn(),
    };
    const clientService = {
      ensureConfigured: vi.fn(),
      getClient: vi.fn().mockResolvedValue({}),
    };
    const configService = {
      get: vi.fn().mockReturnValue('300'),
    };
    const lifecycleService = {
      handle: vi.fn(),
    };
    const sessionStore = {
      save: vi.fn(),
    };
    const orchestrator = new WalletConnectSessionOrchestrator(
      approvalRegistry as never,
      clientService as never,
      configService as never,
      lifecycleService as never,
    );
    Object.assign(orchestrator, { sessionStore });

    const result = await orchestrator.createConnectSession({
      userId: '42',
      chain: 'ethereum',
    });

    expect(clientService.ensureConfigured).toHaveBeenCalled();
    expect(sessionStore.save).toHaveBeenCalledWith({ sessionId: 'session-1' });
    expect(approvalRegistry.set).toHaveBeenCalledWith('session-1', expect.any(Function));
    expect(lifecycleService.handle).toHaveBeenCalledWith('session-1');
    expect(result).toEqual({ sessionId: 'session-1', walletDelivery: 'qr' });
  });
});
