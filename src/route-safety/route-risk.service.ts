import { Injectable } from '@nestjs/common';

import type { IRouteRiskAssessment, IRouteRiskInput } from './interfaces/route-risk.interface';
import { evaluateRouteRisk } from './route-risk.evaluator';

@Injectable()
export class RouteRiskService {
  public evaluate(input: IRouteRiskInput): IRouteRiskAssessment {
    return evaluateRouteRisk(input);
  }
}
