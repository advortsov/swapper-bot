import { Injectable } from '@nestjs/common';
import { encodeFunctionData } from 'viem';

import { ERC20_APPROVE_ABI } from './allowance.constants';
import type { ApprovalMode, IWalletConnectApprovalPayload } from './interfaces/allowance.interface';

@Injectable()
export class AllowanceTransactionService {
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
}
