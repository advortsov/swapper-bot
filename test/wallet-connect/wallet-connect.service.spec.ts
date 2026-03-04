import { describe, expect, it, vi } from 'vitest';

import { WalletConnectService } from '../../src/wallet-connect/wallet-connect.service';

describe('WalletConnectService', () => {
  it('должен делегировать connect в Phantom для solana', async () => {
    const connectedWalletService = {
      createConnectedWalletConnectResponse: vi.fn(),
    };
    const connectionService = {
      getConnectionStatus: vi.fn(),
      disconnect: vi.fn(),
      getReusableSession: vi.fn(),
    };
    const phantomService = {
      createConnectionSession: vi.fn().mockResolvedValue({ sessionId: 's1' }),
      createSwapSessionFromConnection: vi.fn(),
      createSession: vi.fn(),
      getPhantomConnectUrl: vi.fn(),
      handleConnectCallback: vi.fn(),
      handleSignCallback: vi.fn(),
    };
    const orchestrator = {
      createConnectSession: vi.fn(),
      createSwapSession: vi.fn(),
      createApproveSession: vi.fn(),
    };
    const service = new WalletConnectService(
      connectedWalletService as never,
      connectionService as never,
      phantomService as never,
      orchestrator as never,
    );

    const result = await service.connect({
      userId: '42',
      chain: 'solana',
    });

    expect(phantomService.createConnectionSession).toHaveBeenCalledWith({
      userId: '42',
      chain: 'solana',
    });
    expect(result).toEqual({ sessionId: 's1' });
  });

  it('должен возвращать connected-wallet для cached EVM connect', async () => {
    const cached = {
      userId: '42',
      family: 'evm',
      chain: 'arbitrum',
      address: '0xabc',
      topic: 'topic-1',
      walletLabel: 'Wallet',
      connectedAt: 1,
      lastUsedAt: 1,
      expiresAt: 2,
    };
    const connectedWalletService = {
      createConnectedWalletConnectResponse: vi.fn().mockReturnValue({ sessionId: 'cached' }),
    };
    const connectionService = {
      getConnectionStatus: vi.fn(),
      disconnect: vi.fn(),
      getReusableSession: vi.fn().mockReturnValue(cached),
    };
    const phantomService = {
      createConnectionSession: vi.fn(),
      createSwapSessionFromConnection: vi.fn(),
      createSession: vi.fn(),
      getPhantomConnectUrl: vi.fn(),
      handleConnectCallback: vi.fn(),
      handleSignCallback: vi.fn(),
    };
    const orchestrator = {
      createConnectSession: vi.fn(),
      createSwapSession: vi.fn(),
      createApproveSession: vi.fn(),
    };
    const service = new WalletConnectService(
      connectedWalletService as never,
      connectionService as never,
      phantomService as never,
      orchestrator as never,
    );

    const result = await service.connect({
      userId: '42',
      chain: 'arbitrum',
    });

    expect(connectionService.getReusableSession).toHaveBeenCalledWith('42', 'arbitrum');
    expect(connectedWalletService.createConnectedWalletConnectResponse).toHaveBeenCalledWith(
      cached,
    );
    expect(orchestrator.createConnectSession).not.toHaveBeenCalled();
    expect(result).toEqual({ sessionId: 'cached' });
  });

  it('должен делегировать EVM connect в orchestrator без cached session', async () => {
    const connectedWalletService = {
      createConnectedWalletConnectResponse: vi.fn(),
    };
    const connectionService = {
      getConnectionStatus: vi.fn(),
      disconnect: vi.fn(),
      getReusableSession: vi.fn().mockReturnValue(null),
    };
    const phantomService = {
      createConnectionSession: vi.fn(),
      createSwapSessionFromConnection: vi.fn(),
      createSession: vi.fn(),
      getPhantomConnectUrl: vi.fn(),
      handleConnectCallback: vi.fn(),
      handleSignCallback: vi.fn(),
    };
    const orchestrator = {
      createConnectSession: vi.fn().mockResolvedValue({ sessionId: 'created' }),
      createSwapSession: vi.fn(),
      createApproveSession: vi.fn(),
    };
    const service = new WalletConnectService(
      connectedWalletService as never,
      connectionService as never,
      phantomService as never,
      orchestrator as never,
    );

    const input = {
      userId: '42',
      chain: 'ethereum' as const,
    };
    const result = await service.connect(input);

    expect(orchestrator.createConnectSession).toHaveBeenCalledWith(input);
    expect(result).toEqual({ sessionId: 'created' });
  });

  it('должен направлять solana swap в Phantom cached flow', async () => {
    const cached = {
      userId: '42',
      family: 'solana',
      chain: 'solana',
      address: 'So1',
      walletLabel: 'Phantom',
      connectedAt: 1,
      lastUsedAt: 1,
      expiresAt: 2,
      phantom: {
        dappEncryptionPublicKey: 'a',
        dappEncryptionSecretKey: 'b',
      },
    };
    const connectedWalletService = {
      createConnectedWalletConnectResponse: vi.fn(),
      createConnectedWalletSwapResponse: vi.fn(),
      createConnectedWalletApproveResponse: vi.fn(),
    };
    const connectionService = {
      getConnectionStatus: vi.fn(),
      disconnect: vi.fn(),
      getReusableSession: vi.fn().mockReturnValue(cached),
    };
    const phantomService = {
      createConnectionSession: vi.fn(),
      createSwapSessionFromConnection: vi.fn().mockResolvedValue({ sessionId: 'sol' }),
      createSession: vi.fn(),
      getPhantomConnectUrl: vi.fn(),
      handleConnectCallback: vi.fn(),
      handleSignCallback: vi.fn(),
    };
    const orchestrator = {
      createConnectSession: vi.fn(),
      createSwapSession: vi.fn(),
      createApproveSession: vi.fn(),
    };
    const service = new WalletConnectService(
      connectedWalletService as never,
      connectionService as never,
      phantomService as never,
      orchestrator as never,
    );

    const input = {
      userId: '42',
      swapPayload: {
        chain: 'solana' as const,
      },
    };
    const result = await service.createSession(input as never);

    expect(phantomService.createSwapSessionFromConnection).toHaveBeenCalledWith(input, cached);
    expect(result).toEqual({ sessionId: 'sol' });
  });

  it('должен направлять cached EVM swap в connected wallet service', async () => {
    const cached = {
      userId: '42',
      family: 'evm',
      chain: 'base',
      address: '0xabc',
      topic: 'topic-1',
      walletLabel: 'Wallet',
      connectedAt: 1,
      lastUsedAt: 1,
      expiresAt: 2,
    };
    const connectedWalletService = {
      createConnectedWalletConnectResponse: vi.fn(),
      createConnectedWalletSwapResponse: vi.fn().mockReturnValue({ sessionId: 'swap' }),
      createConnectedWalletApproveResponse: vi.fn(),
    };
    const connectionService = {
      getConnectionStatus: vi.fn(),
      disconnect: vi.fn(),
      getReusableSession: vi.fn().mockReturnValue(cached),
    };
    const phantomService = {
      createConnectionSession: vi.fn(),
      createSwapSessionFromConnection: vi.fn(),
      createSession: vi.fn(),
      getPhantomConnectUrl: vi.fn(),
      handleConnectCallback: vi.fn(),
      handleSignCallback: vi.fn(),
    };
    const orchestrator = {
      createConnectSession: vi.fn(),
      createSwapSession: vi.fn(),
      createApproveSession: vi.fn(),
    };
    const service = new WalletConnectService(
      connectedWalletService as never,
      connectionService as never,
      phantomService as never,
      orchestrator as never,
    );

    const input = {
      userId: '42',
      swapPayload: {
        chain: 'base' as const,
      },
    };
    const result = await service.createSession(input as never);

    expect(connectedWalletService.createConnectedWalletSwapResponse).toHaveBeenCalledWith({
      connection: cached,
      swapPayload: input.swapPayload,
    });
    expect(result).toEqual({ sessionId: 'swap' });
  });

  it('должен направлять cached EVM approve в connected wallet service', async () => {
    const cached = {
      userId: '42',
      family: 'evm',
      chain: 'base',
      address: '0xabc',
      topic: 'topic-1',
      walletLabel: 'Wallet',
      connectedAt: 1,
      lastUsedAt: 1,
      expiresAt: 2,
    };
    const connectedWalletService = {
      createConnectedWalletConnectResponse: vi.fn(),
      createConnectedWalletSwapResponse: vi.fn(),
      createConnectedWalletApproveResponse: vi.fn().mockReturnValue({ sessionId: 'approve' }),
    };
    const connectionService = {
      getConnectionStatus: vi.fn(),
      disconnect: vi.fn(),
      getReusableSession: vi.fn().mockReturnValue(cached),
    };
    const phantomService = {
      createConnectionSession: vi.fn(),
      createSwapSessionFromConnection: vi.fn(),
      createSession: vi.fn(),
      getPhantomConnectUrl: vi.fn(),
      handleConnectCallback: vi.fn(),
      handleSignCallback: vi.fn(),
    };
    const orchestrator = {
      createConnectSession: vi.fn(),
      createSwapSession: vi.fn(),
      createApproveSession: vi.fn(),
    };
    const service = new WalletConnectService(
      connectedWalletService as never,
      connectionService as never,
      phantomService as never,
      orchestrator as never,
    );

    const input = {
      userId: '42',
      approvalPayload: {
        chain: 'base' as const,
      },
    };
    const result = await service.createApproveSession(input as never);

    expect(connectedWalletService.createConnectedWalletApproveResponse).toHaveBeenCalledWith({
      connection: cached,
      approvalPayload: input.approvalPayload,
    });
    expect(result).toEqual({ sessionId: 'approve' });
  });

  it('должен делегировать disconnect в connection service', async () => {
    const connectedWalletService = {
      createConnectedWalletConnectResponse: vi.fn(),
      createConnectedWalletSwapResponse: vi.fn(),
      createConnectedWalletApproveResponse: vi.fn(),
    };
    const connectionService = {
      getConnectionStatus: vi.fn(),
      disconnect: vi.fn().mockResolvedValue(undefined),
      getReusableSession: vi.fn(),
    };
    const phantomService = {
      createConnectionSession: vi.fn(),
      createSwapSessionFromConnection: vi.fn(),
      createSession: vi.fn(),
      getPhantomConnectUrl: vi.fn(),
      handleConnectCallback: vi.fn(),
      handleSignCallback: vi.fn(),
    };
    const orchestrator = {
      createConnectSession: vi.fn(),
      createSwapSession: vi.fn(),
      createApproveSession: vi.fn(),
    };
    const service = new WalletConnectService(
      connectedWalletService as never,
      connectionService as never,
      phantomService as never,
      orchestrator as never,
    );

    await service.disconnect('42', 'all');

    expect(connectionService.disconnect).toHaveBeenCalledWith('42', 'all');
  });
});
