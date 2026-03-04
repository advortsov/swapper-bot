import type { IExecutionFeeConfig } from '../../fees/interfaces/fee-policy.interface';

export function resolveJupiterFeeAccount(feeConfig: IExecutionFeeConfig): string | undefined {
  if (feeConfig.kind !== 'jupiter' || feeConfig.mode !== 'enforced') {
    return undefined;
  }

  return feeConfig.feeAccount;
}
