import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ZERO_BPS } from './fee-policy.constants';

@Injectable()
export class FeePolicyConfigService {
  public constructor(private readonly configService: ConfigService) {}

  public getOptionalTrimmed(key: string): string | null {
    const value = this.configService.get<string>(key);

    if (!value || value.trim() === '') {
      return null;
    }

    return value.trim();
  }

  public getOptionalPositiveInteger(key: string): number | null {
    const value = this.getOptionalTrimmed(key);

    if (value === null) {
      return null;
    }

    const parsed = Number.parseInt(value, 10);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      return null;
    }

    return parsed;
  }

  public getOptionalBps(key: string, maxValue: number): number {
    const value = this.getOptionalTrimmed(key);

    if (!value) {
      return ZERO_BPS;
    }

    const parsed = Number.parseInt(value, 10);

    if (!Number.isInteger(parsed) || parsed < ZERO_BPS || parsed > maxValue) {
      return ZERO_BPS;
    }

    return parsed;
  }
}
