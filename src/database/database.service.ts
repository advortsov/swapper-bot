import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kysely, PostgresDialect } from 'kysely';
import path from 'node:path';
import { Pool } from 'pg';
import Postgrator from 'postgrator';

import type { IDatabase } from './database.types';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly db: Kysely<IDatabase>;
  private readonly pool: Pool;
  private readonly databaseUrl: string;

  public constructor(private readonly configService: ConfigService) {
    this.databaseUrl = this.configService.getOrThrow<string>('DATABASE_URL');
    this.pool = new Pool({ connectionString: this.databaseUrl });
    this.db = new Kysely<IDatabase>({
      dialect: new PostgresDialect({ pool: this.pool }),
    });
  }

  public async onModuleInit(): Promise<void> {
    await this.runMigrations();
  }

  public async onModuleDestroy(): Promise<void> {
    await this.db.destroy();
  }

  public getConnection(): Kysely<IDatabase> {
    return this.db;
  }

  private async runMigrations(): Promise<void> {
    const databaseName = this.getDatabaseName(this.databaseUrl);
    const migrationPattern = path.join(process.cwd(), 'database/migrations/*');
    const postgrator = new Postgrator({
      migrationPattern,
      driver: 'pg',
      database: databaseName,
      execQuery: async (query: string) => {
        const result = await this.pool.query(query);
        return {
          rows: result.rows as Record<string, unknown>[],
        };
      },
      schemaTable: 'migrations',
    });

    const appliedMigrations = await postgrator.migrate();

    if (appliedMigrations.length > 0) {
      this.logger.log(
        `Applied migrations: ${appliedMigrations.map((item) => item.filename).join(', ')}`,
      );
    }
  }

  private getDatabaseName(databaseUrl: string): string {
    const parsedUrl = new URL(databaseUrl);
    const databasePath = parsedUrl.pathname.replace('/', '').trim();

    if (databasePath === '') {
      return 'postgres';
    }

    return databasePath;
  }
}
