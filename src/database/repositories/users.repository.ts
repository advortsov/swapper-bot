import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database.service';

export interface IUpsertUserPayload {
  id: string;
  username: string | null;
}

@Injectable()
export class UsersRepository {
  public constructor(private readonly databaseService: DatabaseService) {}

  public async upsertUser(payload: IUpsertUserPayload): Promise<void> {
    await this.databaseService
      .getConnection()
      .insertInto('users')
      .values({
        id: payload.id,
        username: payload.username,
        settings: null,
      })
      .onConflict((conflict) =>
        conflict.column('id').doUpdateSet({
          username: payload.username,
          last_active: new Date(),
        }),
      )
      .execute();
  }

  public async getSettings(userId: string): Promise<Record<string, unknown> | null> {
    const row = await this.databaseService
      .getConnection()
      .selectFrom('users')
      .select('settings')
      .where('id', '=', userId)
      .executeTakeFirst();

    if (!row?.settings) {
      return null;
    }

    return row.settings as Record<string, unknown>;
  }

  public async updateSettings(userId: string, settings: Record<string, unknown>): Promise<void> {
    await this.databaseService
      .getConnection()
      .updateTable('users')
      .set({ settings })
      .where('id', '=', userId)
      .execute();
  }
}
