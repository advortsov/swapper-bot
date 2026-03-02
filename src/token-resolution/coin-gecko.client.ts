import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { ICoinGeckoContractTokenPayload } from './interfaces/token-resolution.interface';
import { BusinessException } from '../common/exceptions/business.exception';

const DEFAULT_COINGECKO_API_BASE_URL = 'https://api.coingecko.com/api/v3';
const HTTP_STATUS_NOT_FOUND = 404;

@Injectable()
export class CoinGeckoClient {
  private readonly apiBaseUrl: string;

  public constructor(private readonly configService: ConfigService) {
    this.apiBaseUrl =
      this.configService.get<string>('COINGECKO_API_BASE_URL') ?? DEFAULT_COINGECKO_API_BASE_URL;
  }

  public async getTokenByContract(
    platform: string,
    address: string,
  ): Promise<ICoinGeckoContractTokenPayload> {
    const response = await fetch(
      `${this.apiBaseUrl}/coins/${platform}/contract/${encodeURIComponent(address)}`,
      {
        headers: {
          accept: 'application/json',
        },
      },
    );

    if (response.status === HTTP_STATUS_NOT_FOUND) {
      throw new BusinessException(`CoinGecko не знает токен ${address} для платформы ${platform}`);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new BusinessException(`CoinGecko contract lookup failed: ${response.status} ${body}`);
    }

    return (await response.json()) as ICoinGeckoContractTokenPayload;
  }
}
