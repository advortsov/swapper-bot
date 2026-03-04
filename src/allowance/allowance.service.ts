import { Inject, Injectable } from '@nestjs/common';

import { AllowanceActionService } from './allowance-action.service';
import { AllowanceContextService } from './allowance-context.service';
import { AllowanceGuardService } from './allowance-guard.service';
import { AllowanceTargetService } from './allowance-target.service';
import { AllowanceTransactionService } from './allowance-transaction.service';
import type {
  ApprovalMode,
  IApproveCommandRequest,
  IApproveOptionsResponse,
  IApproveSessionResponse,
  IPreparedApproveExecution,
  IWalletConnectApprovalPayload,
} from './interfaces/allowance.interface';
import { BusinessException } from '../common/exceptions/business.exception';

@Injectable()
export class AllowanceService {
  @Inject()
  private readonly allowanceTransactionService!: AllowanceTransactionService;

  public constructor(
    private readonly allowanceActionService: AllowanceActionService,
    private readonly allowanceContextService: AllowanceContextService,
    private readonly allowanceGuardService: AllowanceGuardService,
    private readonly allowanceTargetService: AllowanceTargetService,
  ) {}

  public async prepareApproveOptions(
    request: IApproveCommandRequest,
  ): Promise<IApproveOptionsResponse> {
    const context = await this.allowanceContextService.resolveApproveContext(request);
    const options = await this.allowanceTargetService.resolveApprovalOptions({
      ...context,
      walletAddress: request.walletAddress,
    });

    if (options.length === 0) {
      throw new BusinessException(`Не удалось определить spender для ${context.chain}`);
    }

    return this.allowanceActionService.createOptionsAction({
      userId: request.userId,
      walletAddress: request.walletAddress,
      context,
      options,
    });
  }

  public getPreparedApproveExecution(
    userId: string,
    actionToken: string,
    aggregatorName: string,
    mode: ApprovalMode,
  ): IPreparedApproveExecution {
    return this.allowanceActionService.getPreparedApproveExecution(
      userId,
      actionToken,
      aggregatorName,
      mode,
    );
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
    chain: IWalletConnectApprovalPayload['chain'];
    aggregatorName: string;
    walletAddress: string;
    tokenSymbol: string;
    tokenAddress: string;
    tokenDecimals: number;
    buyTokenAddress: string;
    amount: string;
    amountBaseUnits: string;
  }): Promise<void> {
    await this.allowanceGuardService.ensureSufficientAllowance(input);
  }

  public buildApproveTransaction(payload: IWalletConnectApprovalPayload): {
    to: string;
    data: string;
    value: string;
  } {
    return this.allowanceTransactionService.buildApproveTransaction(payload);
  }

  public buildApprovalCallbackData(
    actionToken: string,
    aggregatorName: string,
    mode: ApprovalMode,
  ): string {
    return this.allowanceTransactionService.buildApprovalCallbackData(
      actionToken,
      aggregatorName,
      mode,
    );
  }
}
