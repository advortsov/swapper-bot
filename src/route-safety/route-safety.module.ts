import { Module } from '@nestjs/common';

import { RouteRiskService } from './route-risk.service';

@Module({
  providers: [RouteRiskService],
  exports: [RouteRiskService],
})
export class RouteSafetyModule {}
