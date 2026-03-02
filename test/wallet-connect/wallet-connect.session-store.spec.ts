import { describe, expect, it, vi } from 'vitest';

import { WalletConnectSessionStore } from '../../src/wallet-connect/wallet-connect.session-store';

describe('WalletConnectSessionStore', () => {
  it('должен сохранять и обновлять reusable connection в node-cache', () => {
    vi.useFakeTimers();
    const store = new WalletConnectSessionStore({
      get: vi.fn((key: string) => {
        if (key === 'WALLET_CONNECT_SESSION_TTL_SEC') {
          return '1';
        }

        if (key === 'TELEGRAM_PENDING_ACTION_TTL_SEC') {
          return '60';
        }

        return undefined;
      }),
    } as never);

    store.saveConnection({
      userId: '42',
      family: 'evm',
      chain: 'ethereum',
      address: '0xabc',
      topic: 'topic-1',
      walletLabel: 'Wallet',
      connectedAt: Date.now(),
      lastUsedAt: Date.now(),
      expiresAt: Date.now() + 1_000,
    });

    const touched = store.touchConnection('42', 'evm');

    expect(touched?.address).toBe('0xabc');
    expect(store.getConnection('42', 'evm')?.topic).toBe('topic-1');

    vi.advanceTimersByTime(1_200);

    expect(store.getConnection('42', 'evm')).toBeNull();
    vi.useRealTimers();
  });

  it('должен сохранять pending action по token и по user kind', () => {
    const store = new WalletConnectSessionStore({
      get: vi.fn((key: string) => {
        if (key === 'WALLET_CONNECT_SESSION_TTL_SEC') {
          return '60';
        }

        if (key === 'TELEGRAM_PENDING_ACTION_TTL_SEC') {
          return '60';
        }

        return undefined;
      }),
    } as never);

    store.createPendingAction({
      token: 'token-1',
      userId: '42',
      kind: 'alert-threshold',
      payload: { favoriteId: 'fav-1' },
    });

    expect(store.getPendingAction('token-1')?.payload).toEqual({ favoriteId: 'fav-1' });
    expect(store.getPendingActionByUser('42', 'alert-threshold')?.token).toBe('token-1');
    expect(store.consumePendingAction('42', 'token-1')?.token).toBe('token-1');
    expect(store.getPendingActionByUser('42', 'alert-threshold')).toBeNull();
  });
});
