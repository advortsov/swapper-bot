import { Module } from '@nestjs/common';

import { UserSettingsService } from './user-settings.service';

@Module({
  providers: [UserSettingsService],
  exports: [UserSettingsService],
})
export class SettingsModule {}
