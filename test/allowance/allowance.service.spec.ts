import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import type { IAggregator } from '../../src/aggregators/interfaces/aggregator.interface';
import { AllowanceService } from '../../src/allowance/allowance.service';
import { InsufficientAllowanceException } from '../../src/allowance/insufficient-allowance.exception';
import { WalletConnectSessionStore } from '../../src/wallet-connect/wallet-connect.session-store';

describe('AllowanceService', () => {
  let service: AllowanceService;
  let sessionStore: WalletConnectSessionStore;
  let resolveTokenInputMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    readContractMock.mockReset();
    resolveTokenInputMock = vi.fn();
    const configService = {
      get: vi.fn((key: string) => {
        const values: Record<string, string> = {
          ARBITRUM_RPC_URL: 'https://rpc.example',
        };

        return values[key] ?? '';
      }),
    } as unknown as ConfigService;
    sessionStore = new WalletConnectSessionStore(configService);
    const aggregators: readonly IAggregator[] = [
      {
        name: 'paraswap',
        supportedChains: ['arbitrum'],
        getQuote: vi.fn(),
        buildSwapTransaction: vi.fn(),
        resolveApprovalTarget: vi.fn().mockResolvedValue({
          spenderAddress: '0x1111111111111111111111111111111111111111',
        }),
        healthCheck: vi.fn(),
      },
      {
        name: 'zerox',
        supportedChains: ['arbitrum'],
        getQuote: vi.fn(),
        buildSwapTransaction: vi.fn(),
        resolveApprovalTarget: vi.fn().mockResolvedValue({
          spenderAddress: '0x2222222222222222222222222222222222222222',
        }),
        healthCheck: vi.fn(),
      },
    ];
    const tokenAddressResolverService = {
      resolveTokenInput: resolveTokenInputMock,
    };
    const tokensService = {
      getTokenBySymbol: vi.fn().mockResolvedValue({
        address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      }),
    };

    service = new AllowanceService(
      aggregators,
      configService,
      tokenAddressResolverService as never,
      tokensService as never,
    );
    Object.assign(service, { sessionStore });
  });

  it('должен отклонять approve для нативного токена', async () => {
    resolveTokenInputMock.mockResolvedValue({
      symbol: 'ETH',
      address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      decimals: 18,
    });

    await expect(
      service.prepareApproveOptions({
        userId: '42',
        amount: '1',
        tokenInput: 'ETH',
        chain: 'arbitrum',
        explicitChain: true,
        walletAddress: null,
      }),
    ).rejects.toThrowError('Токен ETH нативный и не требует approve в сети arbitrum');
  });

  it('должен готовить approve options и создавать pending action', async () => {
    resolveTokenInputMock.mockResolvedValue({
      symbol: 'USDC',
      address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      decimals: 6,
    });

    const result = await service.prepareApproveOptions({
      userId: '42',
      amount: '100',
      tokenInput: 'USDC',
      chain: 'arbitrum',
      explicitChain: true,
      walletAddress: null,
    });

    expect(result.tokenSymbol).toBe('USDC');
    expect(result.options).toHaveLength(2);
    expect(result.options[0]?.spenderAddress).toBe('0x1111111111111111111111111111111111111111');
    expect(sessionStore.getPendingAction(result.actionToken)?.userId).toBe('42');
  });

  it('должен строить prepared approve execution для режима max', async () => {
    const action = sessionStore.createPendingAction({
      token: 'approve-token',
      userId: '42',
      kind: 'approve',
      payload: {
        chain: 'arbitrum',
        tokenSymbol: 'USDC',
        tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        tokenDecimals: 6,
        amount: '100',
        amountBaseUnits: '100000000',
        walletAddress: '0x000000000000000000000000000000000000dEaD',
        options: [
          {
            aggregatorName: 'paraswap',
            spenderAddress: '0x1111111111111111111111111111111111111111',
            currentAllowance: '12.5',
            currentAllowanceBaseUnits: '12500000',
          },
        ],
      },
    });

    const prepared = service.getPreparedApproveExecution('42', action.token, 'paraswap', 'max');

    expect(prepared.mode).toBe('max');
    expect(prepared.approveAmountBaseUnits).toMatch(/^\d+$/);
    expect(BigInt(prepared.approveAmountBaseUnits) > BigInt(prepared.amountBaseUnits)).toBe(true);
  });

  it('должен выбрасывать исключение при недостаточном allowance', async () => {
    readContractMock.mockResolvedValue(BigInt(10));

    await expect(
      service.ensureSufficientAllowance({
        userId: '42',
        chain: 'arbitrum',
        aggregatorName: 'paraswap',
        walletAddress: '0x000000000000000000000000000000000000dEaD',
        tokenSymbol: 'USDC',
        tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        tokenDecimals: 6,
        buyTokenAddress: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
        amount: '100',
        amountBaseUnits: '100000000',
      }),
    ).rejects.toBeInstanceOf(InsufficientAllowanceException);
  });
});
