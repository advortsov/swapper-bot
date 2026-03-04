import { describe, expect, it, vi } from 'vitest';

import { WalletConnectLifecycleService } from '../../src/wallet-connect/wallet-connect.lifecycle.service';

vi.mock('../../src/wallet-connect/wallet-connect.evm.helpers', async () => {
  const actual = await vi.importActual<object>(
    '../../src/wallet-connect/wallet-connect.evm.helpers',
  );

  return {
    ...actual,
    waitForWalletConnectApproval: vi.fn().mockResolvedValue({ topic: 'topic-1' }),
    getWalletConnectErrorWithLog: vi.fn().mockReturnValue('boom'),
  };
});

vi.mock('../../src/wallet-connect/wallet-connect.execution', () => ({
  handleWalletConnectSessionError: vi.fn().mockResolvedValue(undefined),
}));

describe('WalletConnectLifecycleService', () => {
  it('должен удалять session и approval после успешного approval flow', async () => {
    const approvalRegistry = {
      get: vi.fn().mockReturnValue(vi.fn()),
      delete: vi.fn(),
    };
    const approvedSessionService = {
      handleApprovedSession: vi.fn().mockResolvedValue(undefined),
    };
    const configService = {
      get: vi.fn().mockReturnValue('telegram-token'),
    };
    const sessionStore = {
      get: vi.fn().mockReturnValue({ sessionId: 's1', expiresAt: Date.now() + 1_000 }),
      delete: vi.fn(),
    };
    const auditService = {
      markError: vi.fn(),
    };
    const service = new WalletConnectLifecycleService(
      approvalRegistry as never,
      approvedSessionService as never,
      configService as never,
      sessionStore as never,
    );
    Object.assign(service, {
      swapExecutionAuditService: auditService,
    });

    await service.handle('s1');

    expect(approvedSessionService.handleApprovedSession).toHaveBeenCalled();
    expect(sessionStore.delete).toHaveBeenCalledWith('s1');
    expect(approvalRegistry.delete).toHaveBeenCalledWith('s1');
  });

  it('должен выходить без действий если session не найдена', async () => {
    const approvalRegistry = {
      get: vi.fn(),
      delete: vi.fn(),
    };
    const approvedSessionService = {
      handleApprovedSession: vi.fn(),
    };
    const configService = {
      get: vi.fn(),
    };
    const sessionStore = {
      get: vi.fn().mockReturnValue(null),
      delete: vi.fn(),
    };
    const auditService = {
      markError: vi.fn(),
    };
    const service = new WalletConnectLifecycleService(
      approvalRegistry as never,
      approvedSessionService as never,
      configService as never,
      sessionStore as never,
    );
    Object.assign(service, {
      swapExecutionAuditService: auditService,
    });

    await service.handle('missing');

    expect(approvalRegistry.get).not.toHaveBeenCalled();
    expect(approvedSessionService.handleApprovedSession).not.toHaveBeenCalled();
  });
});
