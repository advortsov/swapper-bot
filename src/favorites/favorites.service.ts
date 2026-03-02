import { Injectable } from '@nestjs/common';

import { FavoritePairsRepository } from './favorite-pairs.repository';
import type {
  ICreateFavoriteInput,
  IFavoritePairRecord,
  IFavoritePairView,
} from './interfaces/favorite-pair.interface';
import type { IPriceRequest } from '../price/interfaces/price.interface';
import type { IPriceResponse } from '../price/interfaces/price.interface';
import { PriceQuoteService } from '../price/price.quote.service';

@Injectable()
export class FavoritesService {
  public constructor(
    private readonly favoritePairsRepository: FavoritePairsRepository,
    private readonly priceQuoteService: PriceQuoteService,
  ) {}

  public async createFavorite(input: ICreateFavoriteInput): Promise<IFavoritePairRecord> {
    return this.favoritePairsRepository.create(input);
  }

  public async listFavorites(userId: string): Promise<readonly IFavoritePairView[]> {
    return this.favoritePairsRepository.listByUser(userId);
  }

  public async getFavorite(userId: string, favoriteId: string): Promise<IFavoritePairView | null> {
    return this.favoritePairsRepository.findById(favoriteId, userId);
  }

  public async deleteFavorite(userId: string, favoriteId: string): Promise<boolean> {
    return this.favoritePairsRepository.delete(favoriteId, userId);
  }

  public async getBestQuoteForFavorite(favorite: IFavoritePairView): Promise<IPriceResponse> {
    const prepared = await this.priceQuoteService.prepare({
      userId: favorite.userId,
      chain: favorite.chain,
      amount: favorite.amount,
      fromTokenInput: favorite.fromTokenAddress,
      toTokenInput: favorite.toTokenAddress,
      rawCommand: `/favorites ${favorite.amount} ${favorite.fromTokenSymbol} to ${favorite.toTokenSymbol}`,
      explicitChain: true,
    } satisfies IPriceRequest);
    const selection = await this.priceQuoteService.fetchQuoteSelection(prepared);

    return this.priceQuoteService.buildResponse(prepared, selection);
  }
}
