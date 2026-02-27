import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import NodeCache from 'node-cache';

import type { IPriceResponse } from './interfaces/price.interface';

const DEFAULT_CACHE_TTL = 30;

@Injectable()
export class PriceCache {
  private readonly cache: NodeCache;

  public constructor(configService: ConfigService) {
    const ttl = Number.parseInt(
      configService.get<string>('CACHE_TTL_PRICE') ?? `${DEFAULT_CACHE_TTL}`,
      10,
    );

    this.cache = new NodeCache({
      stdTTL: Number.isNaN(ttl) ? DEFAULT_CACHE_TTL : ttl,
      useClones: false,
    });
  }

  public get(key: string): IPriceResponse | null {
    const value = this.cache.get<IPriceResponse>(key);
    return value ?? null;
  }

  public set(key: string, value: IPriceResponse): void {
    this.cache.set(key, value);
  }
}
