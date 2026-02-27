declare module 'postgrator' {
  export interface IPostgratorMigration {
    filename: string;
    version: string;
    action: string;
  }

  export interface IPostgratorConfig {
    migrationPattern: string;
    driver: 'pg';
    database: string;
    execQuery: (query: string) => Promise<{
      rows: Record<string, unknown>[];
    }>;
    execSqlScript?: (sqlScript: string) => Promise<void>;
    schemaTable?: string;
  }

  class Postgrator {
    public constructor(config: IPostgratorConfig);

    public migrate(version?: string | number): Promise<IPostgratorMigration[]>;
  }

  export = Postgrator;
}
