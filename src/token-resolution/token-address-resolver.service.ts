import { Inject, Injectable } from '@nestjs/common';

import { CoinGeckoClient } from './coin-gecko.client';
import { COINGECKO_PLATFORM_BY_CHAIN } from './coin-gecko.platform-map';
import type { IResolvedTokenInput } from './interfaces/token-resolution.interface';
import { CHAINS_TOKEN, type IChainsCollection } from '../chains/chains.constants';
import type { ChainType, IChain } from '../chains/interfaces/chain.interface';
import { BusinessException } from '../common/exceptions/business.exception';
import type { ITokenRecord } from '../tokens/tokens.repository';
import { TokensService } from '../tokens/tokens.service';

@Injectable()
export class TokenAddressResolverService {
  public constructor(
    private readonly coinGeckoClient: CoinGeckoClient,
    private readonly tokensService: TokensService,
    @Inject(CHAINS_TOKEN)
    private readonly chains: IChainsCollection,
  ) {}

  public looksLikeAddress(value: string, chain: ChainType): boolean {
    return this.getChain(chain).validateAddress(value);
  }

  public async resolveTokenInput(
    tokenInput: string,
    chain: ChainType,
    explicitChain: boolean,
  ): Promise<ITokenRecord> {
    if (!this.looksLikeAddress(tokenInput, chain)) {
      return this.tokensService.getTokenBySymbol(tokenInput, chain);
    }

    if (!explicitChain) {
      throw new BusinessException('Для адреса токена обязательно укажи сеть: on <chain>');
    }

    const existingToken = await this.tokensService
      .getTokenByAddress(tokenInput, chain)
      .catch(() => null);

    if (existingToken) {
      return existingToken;
    }

    const resolved = await this.lookupInCoinGecko(tokenInput, chain);

    return this.tokensService.upsertToken({
      address: resolved.address,
      symbol: resolved.symbol,
      name: resolved.name,
      decimals: resolved.decimals,
      chain: resolved.chain,
    });
  }

  private async lookupInCoinGecko(address: string, chain: ChainType): Promise<IResolvedTokenInput> {
    const platform = COINGECKO_PLATFORM_BY_CHAIN[chain];
    const payload = await this.coinGeckoClient.getTokenByContract(platform, address);
    const detailPlatform = payload.detail_platforms?.[platform];
    const decimals = this.resolveDecimals(detailPlatform?.decimal_place, address);
    const symbol = this.resolveSymbol(payload.symbol, address);
    const name = this.resolveName(payload.name, address);
    const normalizedAddress = detailPlatform?.contract_address?.trim() ?? address;

    this.ensureValidResolvedAddress(chain, normalizedAddress);

    return {
      address: normalizedAddress,
      symbol,
      name,
      decimals,
      chain,
    };
  }

  private resolveDecimals(value: number | null | undefined, address: string): number {
    if (typeof value !== 'number') {
      throw new BusinessException(`CoinGecko не вернул decimals для токена ${address}`);
    }

    return value;
  }

  private resolveSymbol(value: string | undefined, address: string): string {
    const symbol = value?.trim().toUpperCase();

    if (!symbol) {
      throw new BusinessException(`CoinGecko вернул неполные данные для токена ${address}`);
    }

    return symbol;
  }

  private resolveName(value: string | undefined, address: string): string {
    const name = value?.trim();

    if (!name) {
      throw new BusinessException(`CoinGecko вернул неполные данные для токена ${address}`);
    }

    return name;
  }

  private ensureValidResolvedAddress(chain: ChainType, address: string): void {
    if (!this.getChain(chain).validateAddress(address)) {
      throw new BusinessException(`CoinGecko вернул невалидный адрес токена ${address}`);
    }
  }

  private getChain(chain: ChainType): IChain {
    const resolvedChain = this.chains.find((candidate) => candidate.name === chain);

    if (!resolvedChain) {
      throw new BusinessException(`Chain ${chain} is not supported`);
    }

    return resolvedChain;
  }
}
