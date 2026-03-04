import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

const readContractMock = vi.fn();

vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');

  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      readContract: readContractMock,
    })),
  };
});

import { AllowanceReaderService } from '../../src/allowance/allowance-reader.service';

describe('AllowanceReaderService', () => {
  it('должен читать allowance через viem client', async () => {
    readContractMock.mockResolvedValue(BigInt(123));
    const configService = {
      get: vi.fn().mockReturnValue('https://rpc.example'),
    } as unknown as ConfigService;
    const service = new AllowanceReaderService(configService);

    const result = await service.readAllowance({
      chain: 'arbitrum',
      tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      ownerAddress: '0x000000000000000000000000000000000000dEaD',
      spenderAddress: '0x1111111111111111111111111111111111111111',
    });

    expect(result).toEqual({ allowanceBaseUnits: '123' });
  });

  it('должен отклонять non-EVM сеть', async () => {
    const configService = {
      get: vi.fn(),
    } as unknown as ConfigService;
    const service = new AllowanceReaderService(configService);

    await expect(
      service.readAllowance({
        chain: 'solana',
        tokenAddress: 'mint',
        ownerAddress: 'owner',
        spenderAddress: 'spender',
      }),
    ).rejects.toThrowError('Approve поддержан только для EVM-сетей');
  });
});
