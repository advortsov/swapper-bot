import type { ChainType } from '../../chains/interfaces/chain.interface';

export type RouteRiskLevel = 'low' | 'medium' | 'high' | 'blocked';

export interface IRouteRiskFactor {
  name: string;
  level: RouteRiskLevel;
  actual: string;
  threshold: string;
}

export interface IRouteRiskAssessment {
  level: RouteRiskLevel;
  factors: readonly IRouteRiskFactor[];
}

export interface IRouteRiskInput {
  slippagePercentage: number;
  estimatedGasUsd: number | null;
  priceImpactPercent: number | null;
  routeHops: number | null;
  chain: ChainType;
}
