import { Injectable } from '@nestjs/common';

import type { ChainType } from '../../chains/interfaces/chain.interface';
import type {
  ICreatePresetInput,
  ITradePresetRecord,
  ITradePresetView,
} from '../../trade-presets/interfaces/trade-preset.interface';
import { DatabaseService } from '../database.service';

@Injectable()
export class TradePresetsRepository {
  public constructor(private readonly databaseService: DatabaseService) {}

  public async create(input: ICreatePresetInput): Promise<ITradePresetRecord> {
    const preset = await this.databaseService
      .getConnection()
      .insertInto('trade_presets')
      .values({
        user_id: input.userId,
        label: input.label,
        chain: input.chain,
        sell_token_address: input.sellTokenAddress,
        buy_token_address: input.buyTokenAddress,
        default_amount: input.defaultAmount ?? null,
      })
      .returning([
        'id',
        'user_id as userId',
        'label',
        'chain',
        'sell_token_address as sellTokenAddress',
        'buy_token_address as buyTokenAddress',
        'default_amount as defaultAmount',
        'created_at as createdAt',
      ])
      .executeTakeFirst();

    if (!preset) {
      throw new Error('Trade preset was not created');
    }

    return this.mapRecord(preset);
  }

  public async findById(id: string, userId: string): Promise<ITradePresetView | null> {
    const preset = await this.databaseService
      .getConnection()
      .selectFrom('trade_presets')
      .innerJoin('tokens as sell_token', (join) =>
        join
          .onRef('sell_token.address', '=', 'trade_presets.sell_token_address')
          .onRef('sell_token.chain', '=', 'trade_presets.chain'),
      )
      .innerJoin('tokens as buy_token', (join) =>
        join
          .onRef('buy_token.address', '=', 'trade_presets.buy_token_address')
          .onRef('buy_token.chain', '=', 'trade_presets.chain'),
      )
      .select([
        'trade_presets.id as id',
        'trade_presets.user_id as userId',
        'trade_presets.label as label',
        'trade_presets.chain as chain',
        'trade_presets.sell_token_address as sellTokenAddress',
        'trade_presets.buy_token_address as buyTokenAddress',
        'trade_presets.default_amount as defaultAmount',
        'trade_presets.created_at as createdAt',
        'sell_token.symbol as sellTokenSymbol',
        'buy_token.symbol as buyTokenSymbol',
      ])
      .where('trade_presets.id', '=', id)
      .where('trade_presets.user_id', '=', userId)
      .executeTakeFirst();

    return preset ? this.mapView(preset) : null;
  }

  public async listByUser(userId: string): Promise<readonly ITradePresetView[]> {
    const presets = await this.databaseService
      .getConnection()
      .selectFrom('trade_presets')
      .innerJoin('tokens as sell_token', (join) =>
        join
          .onRef('sell_token.address', '=', 'trade_presets.sell_token_address')
          .onRef('sell_token.chain', '=', 'trade_presets.chain'),
      )
      .innerJoin('tokens as buy_token', (join) =>
        join
          .onRef('buy_token.address', '=', 'trade_presets.buy_token_address')
          .onRef('buy_token.chain', '=', 'trade_presets.chain'),
      )
      .select([
        'trade_presets.id as id',
        'trade_presets.user_id as userId',
        'trade_presets.label as label',
        'trade_presets.chain as chain',
        'trade_presets.sell_token_address as sellTokenAddress',
        'trade_presets.buy_token_address as buyTokenAddress',
        'trade_presets.default_amount as defaultAmount',
        'trade_presets.created_at as createdAt',
        'sell_token.symbol as sellTokenSymbol',
        'buy_token.symbol as buyTokenSymbol',
      ])
      .where('trade_presets.user_id', '=', userId)
      .orderBy('trade_presets.created_at', 'desc')
      .execute();

    return presets.map((preset) => this.mapView(preset));
  }

  public async delete(id: string, userId: string): Promise<boolean> {
    const result = await this.databaseService
      .getConnection()
      .deleteFrom('trade_presets')
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    return Number(result.numDeletedRows) > 0;
  }

  public async findByLabel(userId: string, label: string): Promise<ITradePresetRecord | null> {
    const preset = await this.databaseService
      .getConnection()
      .selectFrom('trade_presets')
      .select([
        'id',
        'user_id as userId',
        'label',
        'chain',
        'sell_token_address as sellTokenAddress',
        'buy_token_address as buyTokenAddress',
        'default_amount as defaultAmount',
        'created_at as createdAt',
      ])
      .where('user_id', '=', userId)
      .where('label', '=', label)
      .executeTakeFirst();

    return preset ? this.mapRecord(preset) : null;
  }

  private mapRecord(record: {
    id: string;
    userId: string;
    label: string;
    chain: string;
    sellTokenAddress: string;
    buyTokenAddress: string;
    defaultAmount: string | null;
    createdAt: Date;
  }): ITradePresetRecord {
    return {
      id: record.id,
      userId: record.userId,
      label: record.label,
      chain: record.chain as ChainType,
      sellTokenAddress: record.sellTokenAddress,
      buyTokenAddress: record.buyTokenAddress,
      defaultAmount: record.defaultAmount,
      createdAt: record.createdAt,
    };
  }

  private mapView(view: {
    id: string;
    userId: string;
    label: string;
    chain: string;
    sellTokenAddress: string;
    buyTokenAddress: string;
    defaultAmount: string | null;
    createdAt: Date;
    sellTokenSymbol: string;
    buyTokenSymbol: string;
  }): ITradePresetView {
    return {
      ...this.mapRecord(view),
      sellTokenSymbol: view.sellTokenSymbol,
      buyTokenSymbol: view.buyTokenSymbol,
    };
  }
}
