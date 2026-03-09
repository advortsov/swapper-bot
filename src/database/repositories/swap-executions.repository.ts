import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { DatabaseService } from '../database.service';
import type { ISwapExecutionRecord } from '../database.types';

export interface ICreateSwapExecutionPayload {
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
  providerReference?: string | null;
  status: string;
}

@Injectable()
export class SwapExecutionsRepository {
  public constructor(private readonly databaseService: DatabaseService) {}

  public async createExecution(payload: ICreateSwapExecutionPayload): Promise<string> {
    const executionId = randomUUID();

    await this.databaseService
      .getConnection()
      .insertInto('swap_executions')
      .values({
        id: executionId,
        intent_id: payload.intentId,
        user_id: payload.userId,
        chain: payload.chain,
        aggregator: payload.aggregator,
        fee_mode: payload.feeMode,
        fee_bps: payload.feeBps,
        fee_recipient: payload.feeRecipient,
        gross_to_amount: payload.grossToAmount,
        bot_fee_amount: payload.botFeeAmount,
        net_to_amount: payload.netToAmount,
        quote_payload_hash: payload.quotePayloadHash,
        swap_payload_hash: payload.swapPayloadHash,
        provider_reference: payload.providerReference ?? null,
        status: payload.status,
      })
      .execute();

    return executionId;
  }

  public async markSuccess(executionId: string, txHash: string): Promise<void> {
    await this.databaseService
      .getConnection()
      .updateTable('swap_executions')
      .set({
        tx_hash: txHash,
        status: 'success',
        executed_at: new Date(),
        error_message: null,
      })
      .where('id', '=', executionId)
      .execute();
  }

  public async markError(executionId: string, errorMessage: string): Promise<void> {
    await this.databaseService
      .getConnection()
      .updateTable('swap_executions')
      .set({
        status: 'error',
        error_message: errorMessage,
      })
      .where('id', '=', executionId)
      .execute();
  }

  public async updateProviderReference(
    executionId: string,
    providerReference: string,
  ): Promise<void> {
    await this.databaseService
      .getConnection()
      .updateTable('swap_executions')
      .set({
        provider_reference: providerReference,
        status: 'session_created',
      })
      .where('id', '=', executionId)
      .execute();
  }

  public async updateTransactionStatus(
    executionId: string,
    data: {
      transactionStatus: string;
      confirmedAt?: Date;
      gasUsed?: string | null;
      effectiveGasPrice?: string | null;
    },
  ): Promise<void> {
    await this.databaseService
      .getConnection()
      .updateTable('swap_executions')
      .set({
        transaction_status: data.transactionStatus,
        confirmed_at: data.confirmedAt ?? null,
        gas_used: data.gasUsed ?? null,
        effective_gas_price: data.effectiveGasPrice ?? null,
      })
      .where('id', '=', executionId)
      .execute();
  }

  public async findIntentId(executionId: string): Promise<string | null> {
    const row = await this.databaseService
      .getConnection()
      .selectFrom('swap_executions')
      .select('intent_id as intentId')
      .where('id', '=', executionId)
      .executeTakeFirst();

    return row?.intentId ?? null;
  }

  public async findById(executionId: string): Promise<ISwapExecutionRecord | null> {
    const row = await this.databaseService
      .getConnection()
      .selectFrom('swap_executions')
      .selectAll()
      .where('id', '=', executionId)
      .executeTakeFirst();

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      intentId: row.intent_id,
      userId: row.user_id,
      chain: row.chain,
      aggregator: row.aggregator,
      feeMode: row.fee_mode,
      feeBps: row.fee_bps,
      feeRecipient: row.fee_recipient,
      grossToAmount: row.gross_to_amount,
      botFeeAmount: row.bot_fee_amount,
      netToAmount: row.net_to_amount,
      quotePayloadHash: row.quote_payload_hash,
      swapPayloadHash: row.swap_payload_hash,
      providerReference: row.provider_reference,
      txHash: row.tx_hash,
      status: row.status,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      executedAt: row.executed_at,
      transactionStatus: row.transaction_status,
      confirmedAt: row.confirmed_at,
      gasUsed: row.gas_used,
      effectiveGasPrice: row.effective_gas_price,
    };
  }
}
