import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { InternalApiGuard } from '../../src/internal-api/internal-api.guard';

describe('InternalApiGuard', () => {
  const validToken = 'test-secret-token';
  const allowedIp = '192.168.1.100';

  function createMockConfig(overrides?: {
    internalApiToken?: string;
    internalApiAllowedIps?: string[];
  }): { internalApiToken: string; internalApiAllowedIps: string[] } {
    return {
      internalApiToken: overrides?.internalApiToken ?? validToken,
      internalApiAllowedIps: overrides?.internalApiAllowedIps ?? [],
    };
  }

  function createMockContext(authHeader?: string, ip?: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            authorization: authHeader,
          },
          ip,
        }),
      }),
    } as ExecutionContext;
  }

  describe('token validation', () => {
    it('should allow request with valid bearer token', () => {
      const config = createMockConfig();
      const guard = new InternalApiGuard(config as never);
      const context = createMockContext(`Bearer ${validToken}`);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should block request without authorization header', () => {
      const config = createMockConfig();
      const guard = new InternalApiGuard(config as never);
      const context = createMockContext();

      expect(guard.canActivate(context)).toBe(false);
    });

    it('should block request with wrong token', () => {
      const config = createMockConfig();
      const guard = new InternalApiGuard(config as never);
      const context = createMockContext('Bearer wrong-token');

      expect(guard.canActivate(context)).toBe(false);
    });

    it('should block request without Bearer prefix', () => {
      const config = createMockConfig();
      const guard = new InternalApiGuard(config as never);
      const context = createMockContext(validToken);

      expect(guard.canActivate(context)).toBe(false);
    });

    it('should block request with malformed authorization header', () => {
      const config = createMockConfig();
      const guard = new InternalApiGuard(config as never);
      const context = createMockContext('Basic dGVzdDp0ZXN0');

      expect(guard.canActivate(context)).toBe(false);
    });
  });

  describe('IP allowlist validation', () => {
    it('should allow any IP when allowlist is empty', () => {
      const config = createMockConfig({ internalApiAllowedIps: [] });
      const guard = new InternalApiGuard(config as never);
      const context = createMockContext(`Bearer ${validToken}`, '10.0.0.1');

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow request from allowed IP', () => {
      const config = createMockConfig({ internalApiAllowedIps: [allowedIp] });
      const guard = new InternalApiGuard(config as never);
      const context = createMockContext(`Bearer ${validToken}`, allowedIp);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should block request from non-allowed IP', () => {
      const config = createMockConfig({ internalApiAllowedIps: [allowedIp] });
      const guard = new InternalApiGuard(config as never);
      const context = createMockContext(`Bearer ${validToken}`, '10.0.0.1');

      expect(guard.canActivate(context)).toBe(false);
    });

    it('should block request when IP is missing and allowlist is configured', () => {
      const config = createMockConfig({ internalApiAllowedIps: [allowedIp] });
      const guard = new InternalApiGuard(config as never);
      const context = createMockContext(`Bearer ${validToken}`);

      expect(guard.canActivate(context)).toBe(false);
    });

    it('should allow request from one of multiple allowed IPs', () => {
      const config = createMockConfig({
        internalApiAllowedIps: ['192.168.1.1', allowedIp, '10.0.0.1'],
      });
      const guard = new InternalApiGuard(config as never);
      const context = createMockContext(`Bearer ${validToken}`, allowedIp);

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('combined validation', () => {
    it('should require both valid token and allowed IP', () => {
      const config = createMockConfig({ internalApiAllowedIps: [allowedIp] });
      const guard = new InternalApiGuard(config as never);

      const contextWrongToken = createMockContext('Bearer wrong-token', allowedIp);
      expect(guard.canActivate(contextWrongToken)).toBe(false);

      const contextWrongIp = createMockContext(`Bearer ${validToken}`, '10.0.0.1');
      expect(guard.canActivate(contextWrongIp)).toBe(false);

      const contextValid = createMockContext(`Bearer ${validToken}`, allowedIp);
      expect(guard.canActivate(contextValid)).toBe(true);
    });
  });
});
