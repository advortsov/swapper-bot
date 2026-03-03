import { describe, expect, it, vi } from 'vitest';

import { BusinessException } from '../../src/common/exceptions/business.exception';
import {
  normalizeEvmQuantity,
  requestWalletConnectExecution,
} from '../../src/wallet-connect/wallet-connect.evm.helpers';

describe('wallet-connect.evm.helpers', () => {
  it('должен конвертировать decimal quantity в hex для eth_sendTransaction', async () => {
    const requestMock = vi.fn<(input: unknown) => Promise<string>>().mockResolvedValue('0xhash');

    await requestWalletConnectExecution({
      signClient: { request: requestMock } as never,
      topic: 'topic-1',
      chain: 'arbitrum',
      walletAddress: '0xec3a6456bba5b057e90648779d1a143ad60586df',
      transaction: {
        kind: 'evm',
        to: '0x6a000f20005980200259b80c5102003040001068',
        data: '0xdeadbeef',
        value: '10000000000000000',
      },
    });

    const firstCall = requestMock.mock.calls[0]?.[0] as {
      request: {
        method: string;
        params: {
          value: string;
        }[];
      };
    };

    expect(firstCall.request.method).toBe('eth_sendTransaction');
    expect(firstCall.request.params[0]?.value).toBe('0x2386f26fc10000');
  });

  it('должен оставлять hex quantity без изменений', () => {
    expect(normalizeEvmQuantity('0x2386f26fc10000')).toBe('0x2386f26fc10000');
  });

  it('должен падать на невалидном quantity', () => {
    expect(() => normalizeEvmQuantity('not-a-number')).toThrowError(BusinessException);
  });
});
