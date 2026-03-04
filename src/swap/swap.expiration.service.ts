import { Injectable } from '@nestjs/common';

const DEFAULT_SWAP_SLIPPAGE = 0.5;

@Injectable()
export class SwapExpirationService {
  public resolveSlippage(userSlippage: number): number {
    return userSlippage > 0 ? userSlippage : DEFAULT_SWAP_SLIPPAGE;
  }

  public formatQuoteExpiresAt(quoteExpiresAt: Date): string {
    return quoteExpiresAt.toISOString();
  }
}
