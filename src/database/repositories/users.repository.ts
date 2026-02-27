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
}
