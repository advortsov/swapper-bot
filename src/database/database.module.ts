import { Global, Module } from '@nestjs/common';

import { DatabaseService } from './database.service';
import { UsersRepository } from './repositories/users.repository';

@Global()
@Module({
  providers: [DatabaseService, UsersRepository],
  exports: [DatabaseService, UsersRepository],
})
export class DatabaseModule {}
