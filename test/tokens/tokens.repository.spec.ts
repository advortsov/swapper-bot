import { describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../../src/database/database.service';
import { TokensRepository } from '../../src/tokens/tokens.repository';

describe('TokensRepository', () => {
  it('должен использовать upsert-конфликт по chain и address', async () => {
    let capturedConflictColumns: string[] = [];

    const insertBuilder = {
      values: vi.fn(),
      onConflict: vi.fn(),
      execute: vi.fn(),
    };

    insertBuilder.values.mockReturnValue(insertBuilder);
    insertBuilder.onConflict.mockImplementation(
      (
        handler: (conflict: {
          columns: (columns: string[]) => {
            doUpdateSet: (payload: Record<string, unknown>) => Record<string, unknown>;
          };
        }) => unknown,
      ) => {
        handler({
          columns: (columns: string[]) => {
            capturedConflictColumns = columns;
            return {
              doUpdateSet: (payload: Record<string, unknown>) => payload,
            };
          },
        });

        return insertBuilder;
      },
    );
    insertBuilder.execute.mockResolvedValue(undefined);

    const dbConnection = {
      insertInto: vi.fn().mockReturnValue(insertBuilder),
    };
    const databaseService = {
      getConnection: () => dbConnection,
    } as unknown as DatabaseService;
    const repository = new TokensRepository(databaseService);

    await repository.upsertTokens([
      {
        address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        symbol: 'ETH',
        decimals: 18,
        name: 'Ether',
        chain: 'ethereum',
      },
      {
        address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        symbol: 'ETH',
        decimals: 18,
        name: 'Ether',
        chain: 'arbitrum',
      },
    ]);

    expect(capturedConflictColumns).toEqual(['chain', 'address']);
    expect(insertBuilder.execute).toHaveBeenCalledTimes(2);
  });
});
