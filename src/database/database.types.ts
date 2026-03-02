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

export interface ISwapIntentsTable {
  id: string;
  user_id: string;
  chain: string;
  from_symbol: string;
  to_symbol: string;
  amount: string;
  raw_command: string;
  quote_snapshot: ColumnType<JsonValue, JsonValue, JsonValue>;
  allowed_aggregators: string[];
  best_aggregator: string;
  quote_expires_at: Date;
  status: string;
  created_at: Generated<Date>;
  selected_aggregator: string | null;
  selected_at: Date | null;
}

export interface ISwapIntentOptionsTable {
  selection_token: string;
  intent_id: string;
  aggregator: string;
  created_at: Generated<Date>;
  consumed_at: Date | null;
}

export interface ISwapExecutionsTable {
  id: string;
  intent_id: string;
  user_id: string;
  chain: string;
  aggregator: string;
  fee_mode: string;
  fee_bps: number;
  fee_recipient: string | null;
  gross_to_amount: string;
  bot_fee_amount: string;
  net_to_amount: string;
  quote_payload_hash: string;
  swap_payload_hash: string;
  provider_reference: string | null;
  tx_hash: string | null;
  status: string;
  error_message: string | null;
  created_at: Generated<Date>;
  executed_at: Date | null;
}

export interface IFavoritePairsTable {
  id: Generated<string>;
  user_id: string;
  chain: string;
  amount: string;
  from_token_chain: string;
  from_token_address: string;
  to_token_chain: string;
  to_token_address: string;
  created_at: Generated<Date>;
}

export interface IPriceAlertsTable {
  id: Generated<string>;
  favorite_id: string;
  user_id: string;
  target_to_amount: string;
  status: string;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  last_checked_at: Date | null;
  triggered_at: Date | null;
  last_observed_net_to_amount: string | null;
  last_observed_aggregator: string | null;
}

export interface IDatabase {
  users: IUsersTable;
  tokens: ITokensTable;
  requests: IRequestsTable;
  swap_intents: ISwapIntentsTable;
  swap_intent_options: ISwapIntentOptionsTable;
  swap_executions: ISwapExecutionsTable;
  favorite_pairs: IFavoritePairsTable;
  price_alerts: IPriceAlertsTable;
}
