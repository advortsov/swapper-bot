import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';

import { SwapExecutionAuditService } from './swap-execution-audit.service';
import { BusinessException } from '../common/exceptions/business.exception';
import {
  type IConsumeSwapIntentSelectionResult,
  SwapIntentsRepository,
} from '../database/repositories/swap-intents.repository';
import { MetricsService } from '../metrics/metrics.service';
import type { IProviderQuote } from '../price/interfaces/price.interface';
import type { IQuoteSelection, IPreparedPriceInput } from '../price/price.quote.types';
import type {
  IConsumedSwapIntent,
  IStoredProviderQuoteSnapshot,
  ISwapQuoteSnapshot,
} from './interfaces/swap-intent.interface';
import type { ISwapRequest } from './interfaces/swap.interface';

const DEFAULT_QUOTE_TTL_SECONDS = 300;
const MIN_QUOTE_TTL_SECONDS = 1;
const CALLBACK_TOKEN_BYTES = 9;
const HASH_ENCODING = 'hex';
const RISK_CONFIRMATION_TTL_MS = 120_000;

export interface IRiskConfirmationData {
  userId: string;
  consumedIntent: IConsumedSwapIntent;
  selectedQuote: IStoredProviderQuoteSnapshot;
  slippage: number;
}

@Injectable()
export class SwapIntentService {
  private readonly quoteTtlSeconds: number;
  private readonly pendingRiskConfirmations = new Map<
    string,
    IRiskConfirmationData & { expiresAt: number }
  >();

  public constructor(
    private readonly configService: ConfigService,
    private readonly swapIntentsRepository: SwapIntentsRepository,
    private readonly metricsService: MetricsService,
    private readonly swapExecutionAuditService: SwapExecutionAuditService,
  ) {
    this.quoteTtlSeconds = this.resolveQuoteTtlSeconds();
  }

  public async createIntent(
    request: ISwapRequest,
    input: IPreparedPriceInput,
    selection: IQuoteSelection,
  ): Promise<{ intentId: string; quoteExpiresAt: string; selectionTokens: Map<string, string> }> {
    const quoteExpiresAt = new Date(Date.now() + this.quoteTtlSeconds * 1_000);
    const selectionTokens = new Map<string, string>();
    const providerQuotes = selection.successfulQuotes.map((quote) => {
      const selectionToken = randomBytes(CALLBACK_TOKEN_BYTES).toString('base64url');
      selectionTokens.set(quote.aggregatorName, selectionToken);

      return {
        aggregatorName: quote.aggregatorName,
        grossToAmountBaseUnits: quote.grossToAmountBaseUnits,
        netToAmountBaseUnits: quote.toAmountBaseUnits,
        feeAmountBaseUnits: quote.feeAmountBaseUnits,
        feeAmountSymbol: quote.feeAmountSymbol,
        feeAmountDecimals: quote.feeAmountDecimals,
        feeBps: quote.feeBps,
        feeMode: quote.feeMode,
        feeType: quote.feeType,
        feeDisplayLabel: quote.feeDisplayLabel,
        feeAppliedAtQuote: quote.feeAppliedAtQuote,
        feeEnforcedOnExecution: quote.feeEnforcedOnExecution,
        feeAssetSide: quote.feeAssetSide,
        executionFee: quote.executionFee,
        estimatedGasUsd: quote.estimatedGasUsd,
        priceImpactPercent: quote.priceImpactPercent,
        routeHops: quote.routeHops,
        totalNetworkFeeWei: quote.totalNetworkFeeWei,
        rawQuoteHash: this.hashPayload(quote.rawQuote),
      } satisfies IStoredProviderQuoteSnapshot;
    });
    const quoteSnapshot: ISwapQuoteSnapshot = {
      chain: request.chain,
      normalizedAmount: input.normalizedAmount,
      sellAmountBaseUnits: input.sellAmountBaseUnits,
      fromToken: input.fromToken,
      toToken: input.toToken,
      providerQuotes,
    };
    const intentId = await this.swapIntentsRepository.createIntent({
      userId: request.userId,
      chain: request.chain,
      fromSymbol: input.fromToken.symbol,
      toSymbol: input.toToken.symbol,
      amount: request.amount,
      rawCommand: request.rawCommand,
      quoteSnapshot: quoteSnapshot as unknown as Record<string, unknown>,
      allowedAggregators: providerQuotes.map((quote) => quote.aggregatorName),
      bestAggregator: selection.bestQuote.aggregatorName,
      quoteExpiresAt,
      options: providerQuotes.map((quote) => ({
        selectionToken: selectionTokens.get(quote.aggregatorName) ?? '',
        aggregator: quote.aggregatorName,
      })),
    });

    return {
      intentId,
      quoteExpiresAt: quoteExpiresAt.toISOString(),
      selectionTokens,
    };
  }

  public async consumeSelectionToken(
    userId: string,
    selectionToken: string,
  ): Promise<IConsumedSwapIntent> {
    const result = await this.swapIntentsRepository.consumeSelectionToken(userId, selectionToken);

    return this.toConsumedIntent(result);
  }

  public attachSelectionTokens(
    providerQuotes: readonly IProviderQuote[],
    selectionTokens: Map<string, string>,
  ): readonly IProviderQuote[] {
    return providerQuotes.map((quote) => {
      const selectionToken = selectionTokens.get(quote.aggregator);

      if (!selectionToken) {
        return quote;
      }

      return {
        ...quote,
        selectionToken,
      };
    });
  }

  public hashPayload(payload: unknown): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest(HASH_ENCODING);
  }

  public async createExecution(payload: {
    intentId: string;
    userId: string;
    chain: string;
    aggregator: string;
    feeMode: string;
    feeBps: number;
    feeRecipient: string | null;
    grossToAmount: string;
    botFeeAmount: string;
    netToAmount: string;
    quotePayloadHash: string;
    swapPayloadHash: string;
  }): Promise<string> {
    return this.swapExecutionAuditService.createExecution({
      ...payload,
      status: 'initiated',
    });
  }

  public async markExecutionError(
    executionId: string,
    aggregator: string,
    feeMode: string,
    errorMessage: string,
  ): Promise<void> {
    await this.swapExecutionAuditService.markError(executionId, aggregator, feeMode, errorMessage);
  }

  public async attachProviderReference(
    executionId: string,
    providerReference: string,
  ): Promise<void> {
    await this.swapExecutionAuditService.attachProviderReference(executionId, providerReference);
  }

  public storeRiskConfirmation(data: {
    userId: string;
    consumedIntent: IConsumedSwapIntent;
    selectedQuote: IStoredProviderQuoteSnapshot;
    slippage: number;
  }): string {
    const confirmToken = randomBytes(CALLBACK_TOKEN_BYTES).toString('base64url');

    this.pendingRiskConfirmations.set(confirmToken, {
      ...data,
      expiresAt: Date.now() + RISK_CONFIRMATION_TTL_MS,
    });

    return confirmToken;
  }

  public consumeRiskConfirmation(userId: string, confirmToken: string): IRiskConfirmationData {
    const stored = this.pendingRiskConfirmations.get(confirmToken);

    if (!stored) {
      throw new BusinessException('Подтверждение не найдено или уже использовано');
    }

    this.pendingRiskConfirmations.delete(confirmToken);

    if (stored.userId !== userId) {
      throw new BusinessException('Подтверждение не найдено или уже использовано');
    }

    if (Date.now() > stored.expiresAt) {
      throw new BusinessException('Время подтверждения истекло. Отправь /swap заново.');
    }

    return {
      userId: stored.userId,
      consumedIntent: stored.consumedIntent,
      selectedQuote: stored.selectedQuote,
      slippage: stored.slippage,
    };
  }

  private toConsumedIntent(result: IConsumeSwapIntentSelectionResult): IConsumedSwapIntent {
    if (result.status === 'expired') {
      this.metricsService.incrementSwapIntentExpired();
      throw new BusinessException('Своп истёк. Отправь /swap заново.');
    }

    if (result.status !== 'claimed') {
      this.metricsService.incrementSwapIntentInvalidCallback();
      throw new BusinessException('Неверный или уже использованный выбор агрегатора');
    }

    if (
      !result.intentId ||
      !result.userId ||
      !result.aggregator ||
      !result.quoteExpiresAt ||
      !result.quoteSnapshot ||
      !result.chain ||
      !result.rawCommand
    ) {
      this.metricsService.incrementSwapIntentInvalidCallback();
      throw new BusinessException('Swap intent payload is incomplete');
    }

    return {
      intentId: result.intentId,
      userId: result.userId,
      chain: result.chain as ISwapQuoteSnapshot['chain'],
      rawCommand: result.rawCommand,
      aggregator: result.aggregator,
      quoteExpiresAt: result.quoteExpiresAt,
      quoteSnapshot: result.quoteSnapshot as unknown as ISwapQuoteSnapshot,
    };
  }

  private resolveQuoteTtlSeconds(): number {
    const rawValue = this.configService.get<string>('SWAP_TIMEOUT_SECONDS');
    const parsed = Number.parseInt(rawValue ?? `${DEFAULT_QUOTE_TTL_SECONDS}`, 10);

    if (!Number.isInteger(parsed) || parsed < MIN_QUOTE_TTL_SECONDS) {
      return DEFAULT_QUOTE_TTL_SECONDS;
    }

    return parsed;
  }
}
