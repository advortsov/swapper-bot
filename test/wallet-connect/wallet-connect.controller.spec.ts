import { describe, expect, it, vi } from 'vitest';

import { WalletConnectController } from '../../src/wallet-connect/wallet-connect.controller';
import type { WalletConnectService } from '../../src/wallet-connect/wallet-connect.service';

describe('WalletConnectController', () => {
  it('должен отдавать html-страницу для старта Phantom flow', () => {
    const controller = new WalletConnectController({
      getPhantomConnectUrl: vi.fn().mockReturnValue('https://phantom.app/ul/v1/connect?foo=bar'),
    } as unknown as WalletConnectService);
    const response = {
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    controller.openPhantom('session-id', response as never);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.type).toHaveBeenCalledWith('html');
    expect(response.send).toHaveBeenCalledWith(expect.stringContaining('Open Phantom'));
    expect(response.send).toHaveBeenCalledWith(
      expect.stringContaining('https://phantom.app/ul/v1/connect?foo=bar'),
    );
  });
});
