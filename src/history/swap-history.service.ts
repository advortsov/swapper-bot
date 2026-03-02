import { Injectable } from '@nestjs/common';
import { formatUnits } from 'viem';

import type { ISwapHistoryItem } from './interfaces';
import type { ChainType } from '../chains/interfaces/chain.interface';
import { DatabaseService } from '../database/database.service';
import type { ISwapQuoteSnapshot } from '../swap/interfaces/swap-intent.interface';

const HISTORY_LIMIT = 10;

@Injectable()
export class SwapHistoryService {
  public constructor(private readonly databaseService: DatabaseService) {}

  public async listRecent(userId: string): Promise<readonly ISwapHistoryItem[]> {
    const rows = await this.databaseService
      .getConnection()
      .selectFrom('swap_executions')
      .innerJoin('swap_intents', 'swap_intents.id', 'swap_executions.intent_id')
      .select([
        'swap_executions.id as executionId',
        'swap_executions.chain as chain',
        'swap_executions.aggregator as aggregator',
        'swap_executions.gross_to_amount as grossToAmount',
        'swap_executions.bot_fee_amount as botFeeAmount',
        'swap_executions.net_to_amount as netToAmount',
        'swap_executions.tx_hash as txHash',
        'swap_executions.executed_at as executedAt',
        'swap_intents.quote_snapshot as quoteSnapshot',
      ])
      .where('swap_executions.user_id', '=', userId)
      .where('swap_executions.status', '=', 'success')
      .orderBy('swap_executions.executed_at', 'desc')
      .orderBy('swap_executions.created_at', 'desc')
      .limit(HISTORY_LIMIT)
      .execute();

    return rows.map((row) => this.mapRow(row));
  }

  private mapRow(row: {
    executionId: string;
    chain: string;
    aggregator: string;
    grossToAmount: string;
    botFeeAmount: string;
    netToAmount: string;
    txHash: string | null;
    executedAt: Date | null;
    quoteSnapshot: unknown;
  }): ISwapHistoryItem {
    const quoteSnapshot = row.quoteSnapshot as ISwapQuoteSnapshot;
    const toTokenDecimals = quoteSnapshot.toToken.decimals;
    const feeAmountSymbol = this.resolveFeeAmountSymbol(quoteSnapshot, row.aggregator);

    return {
      executionId: row.executionId,
      executedAt: row.executedAt ? row.executedAt.toISOString() : null,
      chain: row.chain as ChainType,
      aggregator: row.aggregator,
      fromAmount: quoteSnapshot.normalizedAmount,
      fromSymbol: quoteSnapshot.fromToken.symbol,
      toAmount: formatUnits(BigInt(row.netToAmount), toTokenDecimals),
      toSymbol: quoteSnapshot.toToken.symbol,
      grossToAmount: formatUnits(BigInt(row.grossToAmount), toTokenDecimals),
      feeAmount: formatUnits(
        BigInt(row.botFeeAmount),
        this.resolveFeeAmountDecimals(quoteSnapshot, row.aggregator),
      ),
      feeAmountSymbol,
      txHash: row.txHash,
    };
  }

  private resolveFeeAmountDecimals(quoteSnapshot: ISwapQuoteSnapshot, aggregator: string): number {
    const providerQuote = quoteSnapshot.providerQuotes.find(
      (candidate) => candidate.aggregatorName === aggregator,
    );

    return providerQuote?.feeAmountDecimals ?? quoteSnapshot.toToken.decimals;
  }

  private resolveFeeAmountSymbol(
    quoteSnapshot: ISwapQuoteSnapshot,
    aggregator: string,
  ): string | null {
    const providerQuote = quoteSnapshot.providerQuotes.find(
      (candidate) => candidate.aggregatorName === aggregator,
    );

    return providerQuote?.feeAmountSymbol ?? quoteSnapshot.toToken.symbol;
  }
}
