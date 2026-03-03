import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  createPublicClient,
  encodeFunctionData,
  formatUnits,
  http,
  maxUint256,
  parseUnits,
} from 'viem';

import {
  ALLOWANCE_ACTION_KIND,
  DUMMY_USER_ADDRESS,
  ERC20_ALLOWANCE_ABI,
  ERC20_APPROVE_ABI,
  EVM_CHAINS,
  EVM_CHAIN_CONFIG,
  EVM_NATIVE_TOKEN_ADDRESS,
  type IAllowanceClient,
  type IEvmChainType,
  type IPendingApproveActionPayload,
  type IResolvedApproveContext,
} from './allowance.constants';
import { InsufficientAllowanceException } from './insufficient-allowance.exception';
import type {
  ApprovalMode,
  IAllowanceCheckRequest,
  IAllowanceCheckResult,
  IApproveCommandRequest,
  IApproveOptionsResponse,
  IApproveOptionView,
  IApproveSessionResponse,
  IApprovalTargetResponse,
  IPreparedApproveExecution,
  IWalletConnectApprovalPayload,
} from './interfaces/allowance.interface';
import { AGGREGATORS_TOKEN } from '../aggregators/aggregators.constants';
import type { IAggregator } from '../aggregators/interfaces/aggregator.interface';
import type { ChainType } from '../chains/interfaces/chain.interface';
import { BusinessException } from '../common/exceptions/business.exception';
import { TokenAddressResolverService } from '../token-resolution/token-address-resolver.service';
import { TokensService } from '../tokens/tokens.service';
import { WalletConnectSessionStore } from '../wallet-connect/wallet-connect.session-store';

@Injectable()
export class AllowanceService {
  @Inject()
  private readonly sessionStore!: WalletConnectSessionStore;

  public constructor(
    @Inject(AGGREGATORS_TOKEN)
    private readonly aggregators: readonly IAggregator[],
    private readonly configService: ConfigService,
    private readonly tokenAddressResolverService: TokenAddressResolverService,
    private readonly tokensService: TokensService,
  ) {}

  public async prepareApproveOptions(
    request: IApproveCommandRequest,
  ): Promise<IApproveOptionsResponse> {
    const context = await this.resolveApproveContext(request);
    const options = await this.resolveApprovalOptions({
      ...context,
      walletAddress: request.walletAddress,
    });

    if (options.length === 0) {
      throw new BusinessException(`Не удалось определить spender для ${context.chain}`);
    }

    const action = this.sessionStore.createPendingAction({
      token: randomUUID(),
      userId: request.userId,
      kind: ALLOWANCE_ACTION_KIND,
      payload: {
        chain: context.chain,
        tokenSymbol: context.tokenSymbol,
        tokenAddress: context.tokenAddress,
        tokenDecimals: context.tokenDecimals,
        amount: context.amount,
        amountBaseUnits: context.amountBaseUnits,
        walletAddress: request.walletAddress,
        options,
      },
    });

    return {
      actionToken: action.token,
      chain: context.chain,
      tokenSymbol: context.tokenSymbol,
      tokenAddress: context.tokenAddress,
      tokenDecimals: context.tokenDecimals,
      amount: context.amount,
      amountBaseUnits: context.amountBaseUnits,
      walletAddress: request.walletAddress,
      options,
    };
  }

  public getPreparedApproveExecution(
    userId: string,
    actionToken: string,
    aggregatorName: string,
    mode: ApprovalMode,
  ): IPreparedApproveExecution {
    const action = this.sessionStore.getPendingAction(actionToken);

    if (action?.userId !== userId || action.kind !== ALLOWANCE_ACTION_KIND) {
      throw new BusinessException('Approve-сессия не найдена или истекла');
    }

    const payload = action.payload as unknown as IPendingApproveActionPayload;
    const option = payload.options.find((item) => item.aggregatorName === aggregatorName);

    if (!option) {
      throw new BusinessException(`Aggregator ${aggregatorName} не доступен для approve`);
    }

    return {
      actionToken,
      chain: payload.chain,
      tokenSymbol: payload.tokenSymbol,
      tokenAddress: payload.tokenAddress,
      tokenDecimals: payload.tokenDecimals,
      amount: payload.amount,
      amountBaseUnits: payload.amountBaseUnits,
      currentAllowance: option.currentAllowance,
      currentAllowanceBaseUnits: option.currentAllowanceBaseUnits,
      aggregatorName,
      spenderAddress: option.spenderAddress,
      mode,
      approveAmountBaseUnits: mode === 'max' ? maxUint256.toString() : payload.amountBaseUnits,
    };
  }

  public toWalletConnectApprovalPayload(
    input: IPreparedApproveExecution,
  ): IWalletConnectApprovalPayload {
    return {
      chain: input.chain,
      tokenSymbol: input.tokenSymbol,
      tokenAddress: input.tokenAddress,
      tokenDecimals: input.tokenDecimals,
      spenderAddress: input.spenderAddress,
      aggregatorName: input.aggregatorName,
      mode: input.mode,
      currentAllowanceBaseUnits: input.currentAllowanceBaseUnits,
      amount: input.amount,
      amountBaseUnits: input.amountBaseUnits,
      approveAmountBaseUnits: input.approveAmountBaseUnits,
    };
  }

  public toApproveSessionResponse(input: {
    prepared: IPreparedApproveExecution;
    session: {
      uri: string | null;
      sessionId: string;
      expiresAt: string;
      walletDelivery: 'qr' | 'app-link' | 'connected-wallet';
    };
  }): IApproveSessionResponse {
    return {
      chain: input.prepared.chain,
      tokenSymbol: input.prepared.tokenSymbol,
      tokenAddress: input.prepared.tokenAddress,
      aggregatorName: input.prepared.aggregatorName,
      spenderAddress: input.prepared.spenderAddress,
      mode: input.prepared.mode,
      amount: input.prepared.amount,
      currentAllowance: input.prepared.currentAllowance,
      walletConnectUri: input.session.uri,
      sessionId: input.session.sessionId,
      expiresAt: input.session.expiresAt,
      walletDelivery: input.session.walletDelivery,
    };
  }

  public async ensureSufficientAllowance(input: {
    userId: string;
    chain: ChainType;
    aggregatorName: string;
    walletAddress: string;
    tokenSymbol: string;
    tokenAddress: string;
    tokenDecimals: number;
    buyTokenAddress: string;
    amount: string;
    amountBaseUnits: string;
  }): Promise<void> {
    if (!this.isEvmChain(input.chain) || this.isNativeToken(input.tokenAddress)) {
      return;
    }

    const approvalTarget = await this.resolveApprovalTarget({
      aggregatorName: input.aggregatorName,
      chain: input.chain,
      sellTokenAddress: input.tokenAddress,
      buyTokenAddress: input.buyTokenAddress,
      sellAmountBaseUnits: input.amountBaseUnits,
      userAddress: input.walletAddress,
    });
    const allowance = await this.checkAllowance({
      chain: input.chain,
      tokenAddress: input.tokenAddress,
      ownerAddress: input.walletAddress,
      spenderAddress: approvalTarget.spenderAddress,
    });

    if (BigInt(allowance.allowanceBaseUnits) >= BigInt(input.amountBaseUnits)) {
      return;
    }

    const action = this.sessionStore.createPendingAction({
      token: randomUUID(),
      userId: input.userId,
      kind: ALLOWANCE_ACTION_KIND,
      payload: {
        chain: input.chain,
        tokenSymbol: input.tokenSymbol,
        tokenAddress: input.tokenAddress,
        tokenDecimals: input.tokenDecimals,
        amount: input.amount,
        amountBaseUnits: input.amountBaseUnits,
        walletAddress: input.walletAddress,
        options: [
          {
            aggregatorName: input.aggregatorName,
            spenderAddress: approvalTarget.spenderAddress,
            currentAllowance: formatUnits(
              BigInt(allowance.allowanceBaseUnits),
              input.tokenDecimals,
            ),
            currentAllowanceBaseUnits: allowance.allowanceBaseUnits,
          },
        ],
      },
    });

    throw new InsufficientAllowanceException({
      chain: input.chain,
      tokenSymbol: input.tokenSymbol,
      tokenAddress: input.tokenAddress,
      tokenDecimals: input.tokenDecimals,
      amount: input.amount,
      amountBaseUnits: input.amountBaseUnits,
      currentAllowance: formatUnits(BigInt(allowance.allowanceBaseUnits), input.tokenDecimals),
      currentAllowanceBaseUnits: allowance.allowanceBaseUnits,
      spenderAddress: approvalTarget.spenderAddress,
      aggregatorName: input.aggregatorName,
      actionToken: action.token,
    });
  }

  public buildApproveTransaction(payload: IWalletConnectApprovalPayload): {
    to: string;
    data: string;
    value: string;
  } {
    return {
      to: payload.tokenAddress,
      data: encodeFunctionData({
        abi: ERC20_APPROVE_ABI,
        functionName: 'approve',
        args: [payload.spenderAddress as `0x${string}`, BigInt(payload.approveAmountBaseUnits)],
      }),
      value: '0',
    };
  }

  public buildApprovalCallbackData(
    actionToken: string,
    aggregatorName: string,
    mode: ApprovalMode,
  ): string {
    return `apr:${actionToken}:${aggregatorName}:${mode}`;
  }

  private async resolveApproveContext(
    request: IApproveCommandRequest,
  ): Promise<IResolvedApproveContext> {
    if (!this.isEvmChain(request.chain)) {
      throw new BusinessException('Approve поддержан только для EVM-сетей');
    }

    const token = await this.tokenAddressResolverService.resolveTokenInput(
      request.tokenInput,
      request.chain,
      request.explicitChain,
    );

    if (this.isNativeToken(token.address)) {
      throw new BusinessException(
        `Токен ${token.symbol} нативный и не требует approve в сети ${request.chain}`,
      );
    }

    return {
      chain: request.chain,
      tokenSymbol: token.symbol,
      tokenAddress: token.address,
      tokenDecimals: token.decimals,
      amount: request.amount,
      amountBaseUnits: parseUnits(request.amount, token.decimals).toString(),
    };
  }

  private async resolveApprovalOptions(
    input: IResolvedApproveContext & {
      walletAddress: string | null;
    },
  ): Promise<readonly IApproveOptionView[]> {
    const quoteTargetToken = await this.resolveQuoteTargetToken(input.chain, input.tokenSymbol);
    const evmAggregators = this.aggregators.filter(
      (aggregator) =>
        aggregator.supportedChains.includes(input.chain) &&
        typeof aggregator.resolveApprovalTarget === 'function',
    );

    const settled = await Promise.allSettled(
      evmAggregators.map(async (aggregator) => {
        const target = await this.resolveApprovalTarget({
          aggregatorName: aggregator.name,
          chain: input.chain,
          sellTokenAddress: input.tokenAddress,
          buyTokenAddress: quoteTargetToken.address,
          sellAmountBaseUnits: input.amountBaseUnits,
          userAddress: input.walletAddress ?? DUMMY_USER_ADDRESS,
        });
        const currentAllowanceBaseUnits = input.walletAddress
          ? (
              await this.checkAllowance({
                chain: input.chain,
                tokenAddress: input.tokenAddress,
                ownerAddress: input.walletAddress,
                spenderAddress: target.spenderAddress,
              })
            ).allowanceBaseUnits
          : null;

        return {
          aggregatorName: aggregator.name,
          spenderAddress: target.spenderAddress,
          currentAllowance:
            currentAllowanceBaseUnits === null
              ? null
              : formatUnits(BigInt(currentAllowanceBaseUnits), input.tokenDecimals),
          currentAllowanceBaseUnits,
        } satisfies IApproveOptionView;
      }),
    );

    return settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
  }

  private async resolveQuoteTargetToken(
    chain: ChainType,
    sellTokenSymbol: string,
  ): Promise<{
    address: string;
  }> {
    const preferredSymbol = sellTokenSymbol.toUpperCase() === 'USDC' ? 'WETH' : 'USDC';
    const token = await this.tokensService.getTokenBySymbol(preferredSymbol, chain);
    return {
      address: token.address,
    };
  }

  private async resolveApprovalTarget(input: {
    aggregatorName: string;
    chain: ChainType;
    sellTokenAddress: string;
    buyTokenAddress: string;
    sellAmountBaseUnits: string;
    userAddress: string;
  }): Promise<IApprovalTargetResponse> {
    const aggregator = this.aggregators.find(
      (candidate) => candidate.name === input.aggregatorName,
    );

    if (!aggregator?.resolveApprovalTarget) {
      throw new BusinessException(
        `Aggregator ${input.aggregatorName} does not support approve flow`,
      );
    }

    return aggregator.resolveApprovalTarget({
      chain: input.chain,
      sellTokenAddress: input.sellTokenAddress,
      buyTokenAddress: input.buyTokenAddress,
      sellAmountBaseUnits: input.sellAmountBaseUnits,
      userAddress: input.userAddress,
    });
  }

  private async checkAllowance(request: IAllowanceCheckRequest): Promise<IAllowanceCheckResult> {
    const client = this.getClient(request.chain);
    const allowance = await client.readContract({
      address: request.tokenAddress as `0x${string}`,
      abi: ERC20_ALLOWANCE_ABI,
      functionName: 'allowance',
      args: [request.ownerAddress as `0x${string}`, request.spenderAddress as `0x${string}`],
    });

    return {
      allowanceBaseUnits: allowance.toString(),
    };
  }

  private getClient(chain: ChainType): IAllowanceClient {
    if (!this.isEvmChain(chain)) {
      throw new BusinessException('Approve поддержан только для EVM-сетей');
    }

    const config = this.getEvmChainConfig(chain);
    return createPublicClient({
      chain: config.chain,
      transport: http(this.configService.get<string>(config.envKey)),
    });
  }

  private getEvmChainConfig(chain: IEvmChainType): (typeof EVM_CHAIN_CONFIG)[IEvmChainType] {
    return EVM_CHAIN_CONFIG[chain];
  }

  private isEvmChain(chain: ChainType): chain is IEvmChainType {
    return EVM_CHAINS.includes(chain as IEvmChainType);
  }

  private isNativeToken(address: string): boolean {
    const normalized = address.trim().toLowerCase();
    return normalized === EVM_NATIVE_TOKEN_ADDRESS;
  }
}
