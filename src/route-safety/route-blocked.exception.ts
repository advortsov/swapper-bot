import type { IRouteRiskAssessment } from './interfaces/route-risk.interface';

export class RouteBlockedException extends Error {
  public readonly assessment: IRouteRiskAssessment;

  constructor(assessment: IRouteRiskAssessment) {
    super('Route is blocked due to excessive risk');
    this.assessment = assessment;
  }
}
