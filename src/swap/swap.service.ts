import { Injectable, Logger } from '@nestjs/common';
import { formatUnits } from 'viem';

import { SwapIntentService } from './swap-intent.service';
import { BusinessException } from '../common/exceptions/business.exception';
import type { IPriceRequest } from '../price/interfaces/price.interface';
import { PriceQuoteService } from '../price/price.quote.service';
import { UserSettingsService } from '../settings/user-settings.service';
import type {
  IConsumedSwapIntent,
  IStoredProviderQuoteSnapshot,
} from './interfaces/swap-intent.interface';
import type {
  ISwapQuotesResponse,
  ISwapRequest,
  ISwapSessionResponse,
} from './interfaces/swap.interface';
import type { IWalletConnectSwapPayload } from '../wallet-connect/interfaces/wallet-connect.interface';
import { WalletConnectService } from '../wallet-connect/wallet-connect.service';

const DEFAULT_SWAP_SLIPPAGE = 0.5;

@Injectable()
export class SwapService {
  private readonly logger = new Logger(SwapService.name);

  public constructor(
    private readonly priceQuoteService: PriceQuoteService,
    private readonly walletConnectService: WalletConnectService,
    private readonly userSettingsService: UserSettingsService,
    private readonly swapIntentService: SwapIntentService,
  ) {}

  public async getSwapQuotes(request: ISwapRequest): Promise<ISwapQuotesResponse> {
    const preparedInput = await this.priceQuoteService.prepare(
      this.toPriceRequest(request.userId, request),
    );
    const quoteSelection = await this.priceQuoteService.fetchQuoteSelection(preparedInput);
    const priceResponse = this.priceQuoteService.buildResponse(preparedInput, quoteSelection);
    const intent = await this.swapIntentService.createIntent(
      request,
      preparedInput,
      quoteSelection,
    );

    return {
      intentId: intent.intentId,
      chain: priceResponse.chain,
      aggregator: priceResponse.aggregator,
      fromSymbol: priceResponse.fromSymbol,
      toSymbol: priceResponse.toSymbol,
      fromTokenAddress: priceResponse.fromTokenAddress,
      toTokenAddress: priceResponse.toTokenAddress,
      fromAmount: priceResponse.fromAmount,
      toAmount: priceResponse.toAmount,
      grossToAmount: priceResponse.grossToAmount,
      feeAmount: priceResponse.feeAmount,
      feeAmountSymbol: priceResponse.feeAmountSymbol,
      feeBps: priceResponse.feeBps,
      feeMode: priceResponse.feeMode,
      feeType: priceResponse.feeType,
      feeDisplayLabel: priceResponse.feeDisplayLabel,
      providersPolled: priceResponse.providersPolled,
      quoteExpiresAt: intent.quoteExpiresAt,
      providerQuotes: this.swapIntentService.attachSelectionTokens(
        priceResponse.providerQuotes,
        intent.selectionTokens,
      ),
    };
  }

  public async createSwapSessionFromSelection(
    userId: string,
    selectionToken: string,
  ): Promise<ISwapSessionResponse> {
    const consumedIntent = await this.swapIntentService.consumeSelectionToken(
      userId,
      selectionToken,
    );
    const userSettings = await this.userSettingsService.getSettings(userId);
    const slippage = userSettings.slippage > 0 ? userSettings.slippage : DEFAULT_SWAP_SLIPPAGE;
    const selectedQuote = this.getSelectedQuote(consumedIntent);
    const executionId = await this.createExecution(consumedIntent, selectedQuote, slippage);

    this.logger.log(
      `Swap session for user ${userId}: slippage=${slippage}%, aggregator=${selectedQuote.aggregatorName}`,
    );
    const walletConnectSession = await this.createWalletConnectSession({
      userId,
      executionId,
      slippage,
      consumedIntent,
      selectedQuote,
    });
    await this.swapIntentService.attachProviderReference(
      executionId,
      walletConnectSession.sessionId,
    );

    return {
      intentId: consumedIntent.intentId,
      chain: consumedIntent.chain,
      aggregator: selectedQuote.aggregatorName,
      fromSymbol: consumedIntent.quoteSnapshot.fromToken.symbol,
      toSymbol: consumedIntent.quoteSnapshot.toToken.symbol,
      fromAmount: consumedIntent.quoteSnapshot.normalizedAmount,
      toAmount: formatUnits(
        BigInt(selectedQuote.netToAmountBaseUnits),
        consumedIntent.quoteSnapshot.toToken.decimals,
      ),
      grossToAmount: formatUnits(
        BigInt(selectedQuote.grossToAmountBaseUnits),
        consumedIntent.quoteSnapshot.toToken.decimals,
      ),
      feeAmount: this.formatFeeAmount(selectedQuote),
      feeAmountSymbol: selectedQuote.feeAmountSymbol,
      feeBps: selectedQuote.feeBps,
      feeMode: selectedQuote.feeMode,
      feeType: selectedQuote.feeType,
      feeDisplayLabel: selectedQuote.feeDisplayLabel,
      walletConnectUri: walletConnectSession.uri,
      sessionId: walletConnectSession.sessionId,
      expiresAt: walletConnectSession.expiresAt,
      quoteExpiresAt: consumedIntent.quoteExpiresAt.toISOString(),
      walletDelivery: walletConnectSession.walletDelivery,
    };
  }

  private async createExecution(
    consumedIntent: IConsumedSwapIntent,
    selectedQuote: IStoredProviderQuoteSnapshot,
    slippage: number,
  ): Promise<string> {
    const swapPayloadHash = this.swapIntentService.hashPayload({
      intentId: consumedIntent.intentId,
      chain: consumedIntent.chain,
      aggregator: selectedQuote.aggregatorName,
      sellTokenAddress: consumedIntent.quoteSnapshot.fromToken.address,
      buyTokenAddress: consumedIntent.quoteSnapshot.toToken.address,
      sellAmountBaseUnits: consumedIntent.quoteSnapshot.sellAmountBaseUnits,
      slippage,
      feeConfig: selectedQuote.executionFee,
    });

    return this.swapIntentService.createExecution({
      intentId: consumedIntent.intentId,
      userId: consumedIntent.userId,
      chain: consumedIntent.chain,
      aggregator: selectedQuote.aggregatorName,
      feeMode: selectedQuote.feeMode,
      feeBps: selectedQuote.feeBps,
      feeRecipient: this.resolveFeeRecipient(selectedQuote),
      grossToAmount: selectedQuote.grossToAmountBaseUnits,
      botFeeAmount: selectedQuote.feeAmountBaseUnits,
      netToAmount: selectedQuote.netToAmountBaseUnits,
      quotePayloadHash: selectedQuote.rawQuoteHash,
      swapPayloadHash,
    });
  }

  private getSelectedQuote(consumedIntent: IConsumedSwapIntent): IStoredProviderQuoteSnapshot {
    const selectedQuote = consumedIntent.quoteSnapshot.providerQuotes.find(
      (quote) => quote.aggregatorName === consumedIntent.aggregator,
    );

    if (!selectedQuote) {
      throw new BusinessException('Selected aggregator is not available in swap intent');
    }

    return selectedQuote;
  }

  private formatFeeAmount(quote: IStoredProviderQuoteSnapshot): string {
    if (quote.feeAmountDecimals === null) {
      return '0';
    }

    return formatUnits(BigInt(quote.feeAmountBaseUnits), quote.feeAmountDecimals);
  }

  private resolveFeeRecipient(quote: IStoredProviderQuoteSnapshot): string | null {
    if (quote.executionFee.kind === 'zerox') {
      return quote.executionFee.feeRecipient;
    }

    if (quote.executionFee.kind === 'paraswap') {
      return quote.executionFee.partnerAddress;
    }

    if (quote.executionFee.kind === 'jupiter') {
      return quote.executionFee.feeAccount;
    }

    return null;
  }

  private toPriceRequest(userId: string, request: ISwapRequest): IPriceRequest {
    return {
      userId,
      amount: request.amount,
      fromTokenInput: request.fromTokenInput,
      toTokenInput: request.toTokenInput,
      chain: request.chain,
      rawCommand: request.rawCommand,
      explicitChain: request.explicitChain,
    };
  }

  private async createWalletConnectSession(input: {
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
    };
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
