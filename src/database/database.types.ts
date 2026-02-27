import type { ColumnType, Generated } from 'kysely';

type JsonValue = Record<string, unknown>;

export interface IUsersTable {
  id: string;
  username: string | null;
  first_seen: Generated<Date>;
  last_active: Generated<Date>;
  settings: ColumnType<JsonValue | null, JsonValue | null, JsonValue | null>;
}

export interface ITokensTable {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  chain: string;
  updated_at: Generated<Date>;
}

export interface IRequestsTable {
  id: string;
  user_id: string;
  command: string;
  from_token: string;
  to_token: string;
  amount: string;
  result: ColumnType<JsonValue | null, JsonValue | null, JsonValue | null>;
  error: boolean;
  error_message: string | null;
  created_at: Generated<Date>;
}

export interface IDatabase {
  users: IUsersTable;
  tokens: ITokensTable;
  requests: IRequestsTable;
}
