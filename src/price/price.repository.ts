import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { DatabaseService } from '../database/database.service';

export interface IRequestLogPayload {
  userId: string;
  command: string;
  fromToken: string;
  toToken: string;
  amount: string;
  result: Record<string, unknown> | null;
  error: boolean;
  errorMessage: string | null;
}

@Injectable()
export class PriceRepository {
  public constructor(private readonly databaseService: DatabaseService) {}

  public async logRequest(payload: IRequestLogPayload): Promise<void> {
    await this.databaseService
      .getConnection()
      .insertInto('requests')
      .values({
        id: randomUUID(),
        user_id: payload.userId,
        command: payload.command,
        from_token: payload.fromToken,
        to_token: payload.toToken,
        amount: payload.amount,
        result: payload.result,
        error: payload.error,
        error_message: payload.errorMessage,
      })
      .execute();
  }
}
