import { Global, Module } from '@nestjs/common';

import { DatabaseService } from './database.service';
import { SwapExecutionsRepository } from './repositories/swap-executions.repository';
import { SwapIntentsRepository } from './repositories/swap-intents.repository';
import { TrackedTransactionsRepository } from './repositories/tracked-transactions.repository';
import { UsersRepository } from './repositories/users.repository';

@Global()
@Module({
  providers: [
    DatabaseService,
    UsersRepository,
    SwapIntentsRepository,
    SwapExecutionsRepository,
    TrackedTransactionsRepository,
  ],
  exports: [
    DatabaseService,
    UsersRepository,
    SwapIntentsRepository,
    SwapExecutionsRepository,
    TrackedTransactionsRepository,
  ],
})
export class DatabaseModule {}
