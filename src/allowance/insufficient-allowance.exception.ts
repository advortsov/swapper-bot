import type { ChainType } from '../chains/interfaces/chain.interface';
import { BusinessException } from '../common/exceptions/business.exception';

export class InsufficientAllowanceException extends BusinessException {
  public constructor(
    public readonly data: {
      chain: ChainType;
      tokenSymbol: string;
      tokenAddress: string;
      tokenDecimals: number;
      amount: string;
      amountBaseUnits: string;
      currentAllowance: string;
      currentAllowanceBaseUnits: string;
      spenderAddress: string;
      aggregatorName: string;
      actionToken: string;
    },
  ) {
    super(`Недостаточный allowance для ${data.tokenSymbol} через ${data.aggregatorName}`);
  }
}
