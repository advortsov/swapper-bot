import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { maxUint256 } from 'viem';

import {
  ALLOWANCE_ACTION_KIND,
  type IPendingApproveActionPayload,
  type IResolvedApproveContext,
} from './allowance.constants';
import type {
  ApprovalMode,
  IApproveOptionsResponse,
  IApproveOptionView,
  IPreparedApproveExecution,
} from './interfaces/allowance.interface';
import { BusinessException } from '../common/exceptions/business.exception';
import { WalletConnectSessionStore } from '../wallet-connect/wallet-connect.session-store';

@Injectable()
export class AllowanceActionService {
  public constructor(private readonly sessionStore: WalletConnectSessionStore) {}

  public createOptionsAction(input: {
    userId: string;
    walletAddress: string | null;
    context: IResolvedApproveContext;
    options: readonly IApproveOptionView[];
  }): IApproveOptionsResponse {
    const action = this.sessionStore.createPendingAction({
      token: randomUUID(),
      userId: input.userId,
      kind: ALLOWANCE_ACTION_KIND,
      payload: this.buildPendingApprovePayload({
        chain: input.context.chain,
        tokenSymbol: input.context.tokenSymbol,
        tokenAddress: input.context.tokenAddress,
        tokenDecimals: input.context.tokenDecimals,
        amount: input.context.amount,
        amountBaseUnits: input.context.amountBaseUnits,
        walletAddress: input.walletAddress,
        options: input.options,
      }) as unknown as Record<string, unknown>,
    });

    return {
      actionToken: action.token,
      chain: input.context.chain,
      tokenSymbol: input.context.tokenSymbol,
      tokenAddress: input.context.tokenAddress,
      tokenDecimals: input.context.tokenDecimals,
      amount: input.context.amount,
      amountBaseUnits: input.context.amountBaseUnits,
      walletAddress: input.walletAddress,
      options: input.options,
    };
  }

  public createInsufficientAllowanceAction(input: {
    userId: string;
    chain: IResolvedApproveContext['chain'];
    tokenSymbol: string;
    tokenAddress: string;
    tokenDecimals: number;
    amount: string;
    amountBaseUnits: string;
    walletAddress: string;
    option: IApproveOptionView;
  }): string {
    const action = this.sessionStore.createPendingAction({
      token: randomUUID(),
      userId: input.userId,
      kind: ALLOWANCE_ACTION_KIND,
      payload: this.buildPendingApprovePayload({
        chain: input.chain,
        tokenSymbol: input.tokenSymbol,
        tokenAddress: input.tokenAddress,
        tokenDecimals: input.tokenDecimals,
        amount: input.amount,
        amountBaseUnits: input.amountBaseUnits,
        walletAddress: input.walletAddress,
        options: [input.option],
      }) as unknown as Record<string, unknown>,
    });

    return action.token;
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

  private buildPendingApprovePayload(input: {
    chain: IResolvedApproveContext['chain'];
    tokenSymbol: string;
    tokenAddress: string;
    tokenDecimals: number;
    amount: string;
    amountBaseUnits: string;
    walletAddress: string | null;
    options: readonly IApproveOptionView[];
  }): IPendingApproveActionPayload {
    return {
      chain: input.chain,
      tokenSymbol: input.tokenSymbol,
      tokenAddress: input.tokenAddress,
      tokenDecimals: input.tokenDecimals,
      amount: input.amount,
      amountBaseUnits: input.amountBaseUnits,
      walletAddress: input.walletAddress,
      options: input.options,
    };
  }
}
