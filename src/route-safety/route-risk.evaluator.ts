import type {
  IRouteRiskAssessment,
  IRouteRiskFactor,
  IRouteRiskInput,
  RouteRiskLevel,
} from './interfaces/route-risk.interface';
import {
  GAS_BLOCKED_USD,
  GAS_HIGH_USD,
  PRICE_IMPACT_BLOCKED_PCT,
  PRICE_IMPACT_HIGH_PCT,
  PRICE_IMPACT_MEDIUM_PCT,
  ROUTE_HOPS_BLOCKED,
  ROUTE_HOPS_HIGH,
  ROUTE_HOPS_MEDIUM,
  SLIPPAGE_BLOCKED_PCT,
  SLIPPAGE_HIGH_PCT,
  SLIPPAGE_MEDIUM_PCT,
} from './route-risk.constants';

const RISK_ORDER: Record<RouteRiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  blocked: 3,
};

export function evaluateRouteRisk(input: IRouteRiskInput): IRouteRiskAssessment {
  const factors: IRouteRiskFactor[] = [];

  const priceImpact = evaluatePriceImpact(input.priceImpactPercent);
  if (priceImpact) factors.push(priceImpact);

  const slippage = evaluateSlippage(input.slippagePercentage);
  factors.push(slippage);

  const gas = evaluateGas(input.estimatedGasUsd);
  if (gas) factors.push(gas);

  const hops = evaluateRouteHops(input.routeHops);
  if (hops) factors.push(hops);

  const overallLevel = factors.reduce<RouteRiskLevel>(
    (max, factor) => (RISK_ORDER[factor.level] > RISK_ORDER[max] ? factor.level : max),
    'low',
  );

  return { level: overallLevel, factors };
}

export function evaluatePriceImpact(value: number | null): IRouteRiskFactor | null {
  if (value === null) return null;

  const actual = `${value}%`;

  if (value >= PRICE_IMPACT_BLOCKED_PCT) {
    return {
      name: 'Price impact',
      level: 'blocked',
      actual,
      threshold: `${PRICE_IMPACT_BLOCKED_PCT}%`,
    };
  }

  if (value >= PRICE_IMPACT_HIGH_PCT) {
    return {
      name: 'Price impact',
      level: 'high',
      actual,
      threshold: `${PRICE_IMPACT_HIGH_PCT}%`,
    };
  }

  if (value >= PRICE_IMPACT_MEDIUM_PCT) {
    return {
      name: 'Price impact',
      level: 'medium',
      actual,
      threshold: `${PRICE_IMPACT_MEDIUM_PCT}%`,
    };
  }

  return {
    name: 'Price impact',
    level: 'low',
    actual,
    threshold: `${PRICE_IMPACT_MEDIUM_PCT}%`,
  };
}

export function evaluateSlippage(value: number): IRouteRiskFactor {
  const actual = `${value}%`;

  if (value >= SLIPPAGE_BLOCKED_PCT) {
    return { name: 'Slippage', level: 'blocked', actual, threshold: `${SLIPPAGE_BLOCKED_PCT}%` };
  }

  if (value >= SLIPPAGE_HIGH_PCT) {
    return { name: 'Slippage', level: 'high', actual, threshold: `${SLIPPAGE_HIGH_PCT}%` };
  }

  if (value >= SLIPPAGE_MEDIUM_PCT) {
    return { name: 'Slippage', level: 'medium', actual, threshold: `${SLIPPAGE_MEDIUM_PCT}%` };
  }

  return { name: 'Slippage', level: 'low', actual, threshold: `${SLIPPAGE_MEDIUM_PCT}%` };
}

export function evaluateGas(value: number | null): IRouteRiskFactor | null {
  if (value === null) return null;

  const actual = `$${value}`;

  if (value >= GAS_BLOCKED_USD) {
    return { name: 'Gas', level: 'blocked', actual, threshold: `$${GAS_BLOCKED_USD}` };
  }

  if (value >= GAS_HIGH_USD) {
    return { name: 'Gas', level: 'high', actual, threshold: `$${GAS_HIGH_USD}` };
  }

  return { name: 'Gas', level: 'low', actual, threshold: `$${GAS_HIGH_USD}` };
}

export function evaluateRouteHops(value: number | null): IRouteRiskFactor | null {
  if (value === null) return null;

  const actual = `${value}`;

  if (value >= ROUTE_HOPS_BLOCKED) {
    return { name: 'Route hops', level: 'blocked', actual, threshold: `${ROUTE_HOPS_BLOCKED}` };
  }

  if (value >= ROUTE_HOPS_HIGH) {
    return { name: 'Route hops', level: 'high', actual, threshold: `${ROUTE_HOPS_HIGH}` };
  }

  if (value >= ROUTE_HOPS_MEDIUM) {
    return { name: 'Route hops', level: 'medium', actual, threshold: `${ROUTE_HOPS_MEDIUM}` };
  }

  return { name: 'Route hops', level: 'low', actual, threshold: `${ROUTE_HOPS_MEDIUM}` };
}
