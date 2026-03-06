import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { DatabaseService } from '../database.service';

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
}
