import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database.service';

export interface ICreateTrackedTransactionPayload {
  hash: string;
  chain: string;
  userId: string;
  executionId: string;
}

export interface ITrackedTransactionRecord {
  hash: string;
  chain: string;
  userId: string;
  executionId: string;
  status: string;
  submittedAt: Date;
  confirmedAt: Date | null;
  failedAt: Date | null;
  blockNumber: string | null;
  gasUsed: string | null;
  effectiveGasPrice: string | null;
  errorMessage: string | null;
}

export interface IMarkConfirmedPayload {
  blockNumber: bigint | null;
  gasUsed: string | null;
  effectiveGasPrice: string | null;
}

@Injectable()
export class TrackedTransactionsRepository {
  public constructor(private readonly databaseService: DatabaseService) {}

  public async create(payload: ICreateTrackedTransactionPayload): Promise<void> {
    await this.databaseService
      .getConnection()
      .insertInto('tracked_transactions')
      .values({
        hash: payload.hash,
        chain: payload.chain,
        user_id: payload.userId,
        execution_id: payload.executionId,
        status: 'pending',
      })
      .execute();
  }

  public async listPending(limit: number): Promise<readonly ITrackedTransactionRecord[]> {
    const rows = await this.databaseService
      .getConnection()
      .selectFrom('tracked_transactions')
      .selectAll()
      .where('status', '=', 'pending')
      .orderBy('submitted_at', 'asc')
      .limit(limit)
      .execute();

    return rows.map((row) => this.mapRecord(row));
  }

  public async markConfirmed(
    chain: string,
    hash: string,
    receipt: IMarkConfirmedPayload,
  ): Promise<void> {
    await this.databaseService
      .getConnection()
      .updateTable('tracked_transactions')
      .set({
        status: 'confirmed',
        confirmed_at: new Date(),
        block_number: receipt.blockNumber !== null ? receipt.blockNumber.toString() : null,
        gas_used: receipt.gasUsed,
        effective_gas_price: receipt.effectiveGasPrice,
      })
      .where('chain', '=', chain)
      .where('hash', '=', hash)
      .execute();
  }

  public async markFailed(chain: string, hash: string, errorMessage: string): Promise<void> {
    await this.databaseService
      .getConnection()
      .updateTable('tracked_transactions')
      .set({
        status: 'failed',
        failed_at: new Date(),
        error_message: errorMessage,
      })
      .where('chain', '=', chain)
      .where('hash', '=', hash)
      .execute();
  }

  public async findByHash(hash: string): Promise<ITrackedTransactionRecord | null> {
    const row = await this.databaseService
      .getConnection()
      .selectFrom('tracked_transactions')
      .selectAll()
      .where('hash', '=', hash)
      .executeTakeFirst();

    return row ? this.mapRecord(row) : null;
  }

  public async findByExecutionId(executionId: string): Promise<ITrackedTransactionRecord | null> {
    const row = await this.databaseService
      .getConnection()
      .selectFrom('tracked_transactions')
      .selectAll()
      .where('execution_id', '=', executionId)
      .executeTakeFirst();

    return row ? this.mapRecord(row) : null;
  }

  private mapRecord(row: {
    hash: string;
    chain: string;
    user_id: string;
    execution_id: string;
    status: string;
    submitted_at: Date;
    confirmed_at: Date | null;
    failed_at: Date | null;
    block_number: string | null;
    gas_used: string | null;
    effective_gas_price: string | null;
    error_message: string | null;
  }): ITrackedTransactionRecord {
    return {
      hash: row.hash,
      chain: row.chain,
      userId: row.user_id,
      executionId: row.execution_id,
      status: row.status,
      submittedAt: row.submitted_at,
      confirmedAt: row.confirmed_at,
      failedAt: row.failed_at,
      blockNumber: row.block_number,
      gasUsed: row.gas_used,
      effectiveGasPrice: row.effective_gas_price,
      errorMessage: row.error_message,
    };
  }
}
