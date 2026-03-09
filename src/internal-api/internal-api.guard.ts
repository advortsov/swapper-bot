import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable, Inject } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import { appConfig } from '../config/app.config';

const BEARER_PREFIX_LENGTH = 7;

@Injectable()
export class InternalApiGuard implements CanActivate {
  public constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) {}

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      ip?: string;
      ips?: string[];
    }>();

    const authHeader = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      return false;
    }

    const token = authHeader.slice(BEARER_PREFIX_LENGTH);

    if (token !== this.config.internalApiToken) {
      return false;
    }

    if (this.config.internalApiAllowedIps.length > 0) {
      const clientIp = this.getClientIp(request);

      if (!clientIp || !this.config.internalApiAllowedIps.includes(clientIp)) {
        return false;
      }
    }

    return true;
  }

  private getClientIp(request: { ip?: string; ips?: string[] }): string | null {
    if (request.ips && request.ips.length > 0) {
      return request.ips[0] ?? null;
    }

    return request.ip ?? null;
  }
}
