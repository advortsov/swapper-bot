import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { DatabaseService } from '../database.service';

export interface ICreateSwapIntentOptionPayload {
  selectionToken: string;
  aggregator: string;
}

export interface ICreateSwapIntentPayload {
  userId: string;
  chain: string;
  fromSymbol: string;
  toSymbol: string;
  amount: string;
  rawCommand: string;
  quoteSnapshot: Record<string, unknown>;
  allowedAggregators: readonly string[];
  bestAggregator: string;
  quoteExpiresAt: Date;
  options: readonly ICreateSwapIntentOptionPayload[];
}

export interface IConsumeSwapIntentSelectionResult {
  status: 'claimed' | 'consumed' | 'expired' | 'invalid';
  intentId?: string;
  userId?: string;
  aggregator?: string;
  rawCommand?: string;
  chain?: string;
  quoteSnapshot?: Record<string, unknown>;
  quoteExpiresAt?: Date;
}

@Injectable()
export class SwapIntentsRepository {
  public constructor(private readonly databaseService: DatabaseService) {}

  public async createIntent(payload: ICreateSwapIntentPayload): Promise<string> {
    const intentId = randomUUID();

    await this.databaseService
      .getConnection()
      .transaction()
      .execute(async (trx) => {
        await trx
          .insertInto('swap_intents')
          .values({
            id: intentId,
            user_id: payload.userId,
            chain: payload.chain,
            from_symbol: payload.fromSymbol,
            to_symbol: payload.toSymbol,
            amount: payload.amount,
            raw_command: payload.rawCommand,
            quote_snapshot: payload.quoteSnapshot,
            allowed_aggregators: [...payload.allowedAggregators],
            best_aggregator: payload.bestAggregator,
            quote_expires_at: payload.quoteExpiresAt,
            status: 'pending',
          })
          .execute();

        if (payload.options.length === 0) {
          return;
        }

        await trx
          .insertInto('swap_intent_options')
          .values(
            payload.options.map((option) => ({
              selection_token: option.selectionToken,
              intent_id: intentId,
              aggregator: option.aggregator,
            })),
          )
          .execute();
      });

    return intentId;
  }

  public async consumeSelectionToken(
    userId: string,
    selectionToken: string,
  ): Promise<IConsumeSwapIntentSelectionResult> {
    return this.databaseService
      .getConnection()
      .transaction()
      .execute(async (trx) => {
        const row = await trx
          .selectFrom('swap_intent_options')
          .innerJoin('swap_intents', 'swap_intents.id', 'swap_intent_options.intent_id')
          .select([
            'swap_intent_options.aggregator as aggregator',
            'swap_intent_options.consumed_at as consumedAt',
            'swap_intents.id as intentId',
            'swap_intents.user_id as userId',
            'swap_intents.raw_command as rawCommand',
            'swap_intents.chain as chain',
            'swap_intents.quote_snapshot as quoteSnapshot',
            'swap_intents.quote_expires_at as quoteExpiresAt',
          ])
          .where('swap_intent_options.selection_token', '=', selectionToken)
          .executeTakeFirst();

        if (row?.userId !== userId) {
          return { status: 'invalid' };
        }

        if (row.consumedAt) {
          return { status: 'consumed' };
        }

        if (row.quoteExpiresAt.getTime() <= Date.now()) {
          await trx
            .updateTable('swap_intents')
            .set({ status: 'expired' })
            .where('id', '=', row.intentId)
            .execute();

          return { status: 'expired' };
        }

        await trx
          .updateTable('swap_intent_options')
          .set({ consumed_at: new Date() })
          .where('selection_token', '=', selectionToken)
          .execute();

        await trx
          .updateTable('swap_intents')
          .set({
            status: 'selected',
            selected_aggregator: row.aggregator,
            selected_at: new Date(),
          })
          .where('id', '=', row.intentId)
          .execute();

        return {
          status: 'claimed',
          intentId: row.intentId,
          userId: row.userId,
          aggregator: row.aggregator,
          rawCommand: row.rawCommand,
          chain: row.chain,
          quoteSnapshot: row.quoteSnapshot as Record<string, unknown>,
          quoteExpiresAt: row.quoteExpiresAt,
        };
      });
  }

  public async updateStatus(intentId: string, status: string): Promise<void> {
    await this.databaseService
      .getConnection()
      .updateTable('swap_intents')
      .set({ status })
      .where('id', '=', intentId)
      .execute();
  }
}
