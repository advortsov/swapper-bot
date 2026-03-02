import { Injectable } from '@nestjs/common';

import { FeePolicyService } from './fee-policy.service';
import type { IQuoteResponse } from '../aggregators/interfaces/aggregator.interface';
import { MetricsService } from '../metrics/metrics.service';
import type { IFeePolicy } from './interfaces/fee-policy.interface';
import type { ITokenRecord } from '../tokens/tokens.repository';

const BPS_DENOMINATOR = 10_000n;
const ZERO_BIGINT = 0n;

@Injectable()
export class QuoteMonetizationService {
  public constructor(
    private readonly metricsService: MetricsService,
    private readonly feePolicyService: FeePolicyService,
  ) {}

  public getPolicy(
    aggregatorName: string,
    chain: ITokenRecord['chain'],
    fromToken: ITokenRecord,
    toToken: ITokenRecord,
  ): IFeePolicy {
    return this.feePolicyService.getPolicy(aggregatorName, chain, fromToken, toToken);
  }

  public applyPolicy(input: {
    rawQuote: IQuoteResponse;
    feePolicy: IFeePolicy;
    fromToken: ITokenRecord;
    toToken: ITokenRecord;
    sellAmountBaseUnits: string;
  }): IQuoteResponse {
    const { rawQuote, feePolicy, fromToken, toToken, sellAmountBaseUnits } = input;
    const hasProviderFeeBreakdown = this.hasProviderFeeBreakdown(rawQuote, feePolicy);
    const feeAmountBaseUnits = hasProviderFeeBreakdown
      ? rawQuote.feeAmountBaseUnits
      : this.calculateFeeAmount(
          feePolicy,
          rawQuote.grossToAmountBaseUnits || rawQuote.toAmountBaseUnits,
          sellAmountBaseUnits,
        );
    const grossToAmountBaseUnits = this.resolveGrossToAmountBaseUnits(
      rawQuote,
      feePolicy,
      feeAmountBaseUnits,
      hasProviderFeeBreakdown,
    );
    const netToAmountBaseUnits = hasProviderFeeBreakdown
      ? rawQuote.toAmountBaseUnits
      : feePolicy.executionFee.feeAssetSide === 'buy'
        ? this.subtractFee(grossToAmountBaseUnits, feeAmountBaseUnits)
        : grossToAmountBaseUnits;
    const feeAmountSymbol = this.resolveFeeAmountSymbol(
      feePolicy.executionFee.feeAssetSide,
      fromToken,
      toToken,
    );
    const feeAmountDecimals = this.resolveFeeAmountDecimals(
      feePolicy.executionFee.feeAssetSide,
      fromToken,
      toToken,
    );
    const quote: IQuoteResponse = {
      ...rawQuote,
      toAmountBaseUnits: netToAmountBaseUnits,
      grossToAmountBaseUnits,
      feeAmountBaseUnits,
      feeAmountSymbol,
      feeAmountDecimals,
      feeBps: feePolicy.feeBps,
      feeMode: feePolicy.mode,
      feeType: feePolicy.feeType,
      feeDisplayLabel: feePolicy.displayLabel,
      feeAppliedAtQuote: feePolicy.executionFee.feeAppliedAtQuote,
      feeEnforcedOnExecution: feePolicy.executionFee.feeEnforcedOnExecution,
      feeAssetSide: feePolicy.executionFee.feeAssetSide,
      executionFee: feePolicy.executionFee,
    };

    this.metricsService.incrementSwapFeeQuote(quote.aggregatorName, quote.feeMode);

    if (quote.feeMode === 'enforced' && quote.feeAmountSymbol) {
      this.metricsService.addExpectedFeeAmount(
        quote.aggregatorName,
        quote.feeAmountSymbol,
        quote.feeAmountBaseUnits,
        quote.feeAmountDecimals,
      );
    }

    if (!feePolicy.isEnabled) {
      this.metricsService.incrementSwapFeeMissingConfiguration(
        quote.aggregatorName,
        fromToken.chain,
      );
    }

    return quote;
  }

  private hasProviderFeeBreakdown(rawQuote: IQuoteResponse, feePolicy: IFeePolicy): boolean {
    return (
      feePolicy.mode === 'enforced' &&
      feePolicy.executionFee.feeAppliedAtQuote &&
      BigInt(rawQuote.feeAmountBaseUnits) > ZERO_BIGINT
    );
  }

  private resolveGrossToAmountBaseUnits(
    rawQuote: IQuoteResponse,
    feePolicy: IFeePolicy,
    feeAmountBaseUnits: string,
    hasProviderFeeBreakdown: boolean,
  ): string {
    if (!hasProviderFeeBreakdown) {
      return rawQuote.grossToAmountBaseUnits || rawQuote.toAmountBaseUnits;
    }

    const declaredGross = BigInt(rawQuote.grossToAmountBaseUnits);
    const declaredNet = BigInt(rawQuote.toAmountBaseUnits);
    const feeAmount = BigInt(feeAmountBaseUnits);

    if (declaredGross > declaredNet) {
      return rawQuote.grossToAmountBaseUnits;
    }

    if (feePolicy.executionFee.feeAssetSide !== 'buy') {
      return rawQuote.toAmountBaseUnits;
    }

    return (declaredNet + feeAmount).toString();
  }

  private calculateFeeAmount(
    feePolicy: IFeePolicy,
    grossToAmountBaseUnits: string,
    sellAmountBaseUnits: string,
  ): string {
    if (feePolicy.mode !== 'enforced' || feePolicy.feeBps === 0) {
      return '0';
    }

    const sourceAmount =
      feePolicy.executionFee.feeAssetSide === 'buy' ? grossToAmountBaseUnits : sellAmountBaseUnits;

    return ((BigInt(sourceAmount) * BigInt(feePolicy.feeBps)) / BPS_DENOMINATOR).toString();
  }

  private subtractFee(amountBaseUnits: string, feeAmountBaseUnits: string): string {
    const amount = BigInt(amountBaseUnits);
    const fee = BigInt(feeAmountBaseUnits);

    if (fee <= ZERO_BIGINT || fee >= amount) {
      return amountBaseUnits;
    }

    return (amount - fee).toString();
  }

  private resolveFeeAmountSymbol(
    feeAssetSide: 'buy' | 'sell' | 'none',
    fromToken: ITokenRecord,
    toToken: ITokenRecord,
  ): string | null {
    if (feeAssetSide === 'buy') {
      return toToken.symbol;
    }

    if (feeAssetSide === 'sell') {
      return fromToken.symbol;
    }

    return null;
  }

  private resolveFeeAmountDecimals(
    feeAssetSide: 'buy' | 'sell' | 'none',
    fromToken: ITokenRecord,
    toToken: ITokenRecord,
  ): number | null {
    if (feeAssetSide === 'buy') {
      return toToken.decimals;
    }

    if (feeAssetSide === 'sell') {
      return fromToken.decimals;
    }

    return null;
  }
}
