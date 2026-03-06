import type { IRouteRiskAssessment } from './interfaces/route-risk.interface';

export class HighRiskRouteException extends Error {
  public readonly assessment: IRouteRiskAssessment;
  public readonly confirmToken: string;

  constructor(assessment: IRouteRiskAssessment, confirmToken: string) {
    super('Route risk level is high');
    this.assessment = assessment;
    this.confirmToken = confirmToken;
  }
}
