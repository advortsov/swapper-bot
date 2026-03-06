import { Injectable } from '@nestjs/common';
import { formatUnits } from 'viem';

import type {
  IConsumedSwapIntent,
  IStoredProviderQuoteSnapshot,
} from './interfaces/swap-intent.interface';
import type { ISwapSessionResponse } from './interfaces/swap.interface';
import { SwapIntentService } from './swap-intent.service';
import { BusinessException } from '../common/exceptions/business.exception';
import type { IWalletConnectSwapPayload } from '../wallet-connect/interfaces/wallet-connect.interface';
import { WalletConnectService } from '../wallet-connect/wallet-connect.service';

@Injectable()
export class SwapSessionService {
  public constructor(
    private readonly walletConnectService: WalletConnectService,
    private readonly swapIntentService: SwapIntentService,
  ) {}

  public async createWalletConnectSession(input: {
    userId: string;
    executionId: string;
    slippage: number;
    consumedIntent: IConsumedSwapIntent;
    selectedQuote: IStoredProviderQuoteSnapshot;
  }): Promise<Awaited<ReturnType<WalletConnectService['createSession']>>> {
    const swapPayload = this.buildSwapPayload(input);

    try {
      return await this.walletConnectService.createSession({
        userId: input.userId,
        swapPayload,
      });
    } catch (error: unknown) {
      await this.swapIntentService.markExecutionError(
        input.executionId,
        input.selectedQuote.aggregatorName,
        input.selectedQuote.feeMode,
        this.getErrorMessage(error),
      );
      throw error;
    }
  }

  public async attachProviderReference(executionId: string, sessionId: string): Promise<void> {
    await this.swapIntentService.attachProviderReference(executionId, sessionId);
  }

  public buildResponse(input: {
    consumedIntent: IConsumedSwapIntent;
    selectedQuote: IStoredProviderQuoteSnapshot;
    walletConnectSession: Awaited<ReturnType<WalletConnectService['createSession']>>;
    quoteExpiresAt: string;
  }): ISwapSessionResponse {
    return {
      intentId: input.consumedIntent.intentId,
      chain: input.consumedIntent.chain,
      aggregator: input.selectedQuote.aggregatorName,
      fromSymbol: input.consumedIntent.quoteSnapshot.fromToken.symbol,
      toSymbol: input.consumedIntent.quoteSnapshot.toToken.symbol,
      fromAmount: input.consumedIntent.quoteSnapshot.normalizedAmount,
      toAmount: formatUnits(
        BigInt(input.selectedQuote.netToAmountBaseUnits),
        input.consumedIntent.quoteSnapshot.toToken.decimals,
      ),
      grossToAmount: formatUnits(
        BigInt(input.selectedQuote.grossToAmountBaseUnits),
        input.consumedIntent.quoteSnapshot.toToken.decimals,
      ),
      feeAmount: this.formatFeeAmount(input.selectedQuote),
      feeAmountSymbol: input.selectedQuote.feeAmountSymbol,
      feeBps: input.selectedQuote.feeBps,
      feeMode: input.selectedQuote.feeMode,
      feeType: input.selectedQuote.feeType,
      feeDisplayLabel: input.selectedQuote.feeDisplayLabel,
      walletConnectUri: input.walletConnectSession.uri,
      sessionId: input.walletConnectSession.sessionId,
      expiresAt: input.walletConnectSession.expiresAt,
      quoteExpiresAt: input.quoteExpiresAt,
      walletDelivery: input.walletConnectSession.walletDelivery,
    };
  }

  private buildSwapPayload(input: {
    executionId: string;
    slippage: number;
    consumedIntent: IConsumedSwapIntent;
    selectedQuote: IStoredProviderQuoteSnapshot;
  }): IWalletConnectSwapPayload {
    return {
      intentId: input.consumedIntent.intentId,
      executionId: input.executionId,
      chain: input.consumedIntent.chain,
      aggregatorName: input.selectedQuote.aggregatorName,
      fromSymbol: input.consumedIntent.quoteSnapshot.fromToken.symbol,
      toSymbol: input.consumedIntent.quoteSnapshot.toToken.symbol,
      sellTokenAddress: input.consumedIntent.quoteSnapshot.fromToken.address,
      buyTokenAddress: input.consumedIntent.quoteSnapshot.toToken.address,
      sellAmountBaseUnits: input.consumedIntent.quoteSnapshot.sellAmountBaseUnits,
      sellTokenDecimals: input.consumedIntent.quoteSnapshot.fromToken.decimals,
      buyTokenDecimals: input.consumedIntent.quoteSnapshot.toToken.decimals,
      slippagePercentage: input.slippage,
      grossToAmountBaseUnits: input.selectedQuote.grossToAmountBaseUnits,
      netToAmountBaseUnits: input.selectedQuote.netToAmountBaseUnits,
      feeAmountBaseUnits: input.selectedQuote.feeAmountBaseUnits,
      feeAmountSymbol: input.selectedQuote.feeAmountSymbol,
      feeAmountDecimals: input.selectedQuote.feeAmountDecimals,
      feeMode: input.selectedQuote.feeMode,
      feeType: input.selectedQuote.feeType,
      feeBps: input.selectedQuote.feeBps,
      feeDisplayLabel: input.selectedQuote.feeDisplayLabel,
      feeAssetSide: input.selectedQuote.feeAssetSide,
      executionFee: input.selectedQuote.executionFee,
      estimatedGasUsd: input.selectedQuote.estimatedGasUsd,
      priceImpactPercent: input.selectedQuote.priceImpactPercent,
      routeHops: input.selectedQuote.routeHops,
    };
  }

  private formatFeeAmount(quote: IStoredProviderQuoteSnapshot): string {
    if (quote.feeAmountDecimals === null) {
      return '0';
    }

    return formatUnits(BigInt(quote.feeAmountBaseUnits), quote.feeAmountDecimals);
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof BusinessException) {
      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown internal error';
  }
}
