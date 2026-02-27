import { Module } from '@nestjs/common';

import { TokensRepository } from './tokens.repository';
import { TokensService } from './tokens.service';

@Module({
  providers: [TokensRepository, TokensService],
  exports: [TokensService],
})
export class TokensModule {}
