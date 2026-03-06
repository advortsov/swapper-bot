import { describe, expect, it } from 'vitest';

import {
  evaluateGas,
  evaluatePriceImpact,
  evaluateRouteHops,
  evaluateRouteRisk,
  evaluateSlippage,
} from '../../src/route-safety/route-risk.evaluator';

describe('evaluateRouteRisk', () => {
  it('should return low when all factors are null', () => {
    const result = evaluateRouteRisk({
      slippagePercentage: 0.5,
      estimatedGasUsd: null,
      priceImpactPercent: null,
      routeHops: null,
      chain: 'ethereum',
    });

    expect(result.level).toBe('low');
  });

  it('should return blocked when any factor is blocked', () => {
    const result = evaluateRouteRisk({
      slippagePercentage: 0.5,
      estimatedGasUsd: null,
      priceImpactPercent: 15,
      routeHops: null,
      chain: 'ethereum',
    });

    expect(result.level).toBe('blocked');
  });

  it('should return high when highest factor is high', () => {
    const result = evaluateRouteRisk({
      slippagePercentage: 0.5,
      estimatedGasUsd: 60,
      priceImpactPercent: 0.5,
      routeHops: null,
      chain: 'ethereum',
    });

    expect(result.level).toBe('high');
  });

  it('should return medium when highest factor is medium', () => {
    const result = evaluateRouteRisk({
      slippagePercentage: 1.5,
      estimatedGasUsd: 10,
      priceImpactPercent: 0.5,
      routeHops: null,
      chain: 'ethereum',
    });

    expect(result.level).toBe('medium');
  });

  it('blocked > high > medium > low ordering', () => {
    const result = evaluateRouteRisk({
      slippagePercentage: 1.5,
      estimatedGasUsd: 60,
      priceImpactPercent: 12,
      routeHops: 3,
      chain: 'ethereum',
    });

    expect(result.level).toBe('blocked');
    expect(result.factors).toHaveLength(4);
  });

  it('should include all evaluated factors in the result', () => {
    const result = evaluateRouteRisk({
      slippagePercentage: 0.5,
      estimatedGasUsd: 10,
      priceImpactPercent: 2,
      routeHops: 4,
      chain: 'ethereum',
    });

    const factorNames = result.factors.map((f) => f.name);
    expect(factorNames).toContain('Price impact');
    expect(factorNames).toContain('Slippage');
    expect(factorNames).toContain('Gas');
    expect(factorNames).toContain('Route hops');
  });
});

describe('evaluatePriceImpact', () => {
  it('should return null for null value', () => {
    expect(evaluatePriceImpact(null)).toBeNull();
  });

  it('should return low for < 1%', () => {
    expect(evaluatePriceImpact(0.5)?.level).toBe('low');
  });

  it('should return medium for >= 1% and < 3%', () => {
    expect(evaluatePriceImpact(1)?.level).toBe('medium');
    expect(evaluatePriceImpact(2.9)?.level).toBe('medium');
  });

  it('should return high for >= 3% and < 10%', () => {
    expect(evaluatePriceImpact(3)?.level).toBe('high');
    expect(evaluatePriceImpact(9.9)?.level).toBe('high');
  });

  it('should return blocked for >= 10%', () => {
    expect(evaluatePriceImpact(10)?.level).toBe('blocked');
    expect(evaluatePriceImpact(15)?.level).toBe('blocked');
  });
});

describe('evaluateSlippage', () => {
  it('should return low for < 1%', () => {
    expect(evaluateSlippage(0.5).level).toBe('low');
  });

  it('should return medium for >= 1% and < 3%', () => {
    expect(evaluateSlippage(1).level).toBe('medium');
    expect(evaluateSlippage(2.9).level).toBe('medium');
  });

  it('should return high for >= 3% and < 10%', () => {
    expect(evaluateSlippage(3).level).toBe('high');
  });

  it('should return blocked for >= 10%', () => {
    expect(evaluateSlippage(10).level).toBe('blocked');
  });
});

describe('evaluateGas', () => {
  it('should return null for null value', () => {
    expect(evaluateGas(null)).toBeNull();
  });

  it('should return low for < $50', () => {
    expect(evaluateGas(10)?.level).toBe('low');
  });

  it('should return high for >= $50 and < $200', () => {
    expect(evaluateGas(50)?.level).toBe('high');
    expect(evaluateGas(199)?.level).toBe('high');
  });

  it('should return blocked for >= $200', () => {
    expect(evaluateGas(200)?.level).toBe('blocked');
  });
});

describe('evaluateRouteHops', () => {
  it('should return null for null value', () => {
    expect(evaluateRouteHops(null)).toBeNull();
  });

  it('should return low for < 3', () => {
    expect(evaluateRouteHops(2)?.level).toBe('low');
  });

  it('should return medium for >= 3 and < 5', () => {
    expect(evaluateRouteHops(3)?.level).toBe('medium');
    expect(evaluateRouteHops(4)?.level).toBe('medium');
  });

  it('should return high for >= 5 and < 8', () => {
    expect(evaluateRouteHops(5)?.level).toBe('high');
  });

  it('should return blocked for >= 8', () => {
    expect(evaluateRouteHops(8)?.level).toBe('blocked');
  });
});
