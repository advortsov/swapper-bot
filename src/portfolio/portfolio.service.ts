import { Injectable, Inject } from '@nestjs/common';

import type { IPortfolioAsset, IPortfolioSummary } from './interfaces/portfolio.interface';
import { TokenBalanceReaderService } from './token-balance-reader.service';
import { CHAINS_TOKEN } from '../chains/chains.module';
import type { ChainType } from '../chains/interfaces/chain.interface';
import { TokensRepository } from '../tokens/tokens.repository';
import { WalletConnectService } from '../wallet-connect/wallet-connect.service';

const PORTFOLIO_MAX_ASSETS = 20;
const DEFAULT_ESTIMATED_USD = null;
const BALANCE_BASE = 10;
const MIN_DISPLAY_BALANCE = 0.001;
const BALANCE_DECIMAL_PLACES = 4;

@Injectable()
export class PortfolioService {
  @Inject(CHAINS_TOKEN)
  private readonly chains!: readonly ChainType[];

  public constructor(
    private readonly tokenBalanceReader: TokenBalanceReaderService,
    private readonly tokensRepository: TokensRepository,
    private readonly walletConnectService: WalletConnectService,
  ) {}

  public async getUserPortfolio(userId: string): Promise<IPortfolioSummary> {
    const assets: IPortfolioAsset[] = [];

    for (const chain of this.chains) {
      const session = this.walletConnectService.getReusableSession(userId, chain);

      if (!session) {
        continue;
      }

      const chainAssets = await this.getAssetsForChain(chain, session.address);

      assets.push(...chainAssets);
    }

    const totalEstimatedUsd = this.calculateTotalUsd(assets);

    return {
      totalEstimatedUsd,
      assets: this.sortAssets(assets).slice(0, PORTFOLIO_MAX_ASSETS),
    };
  }

  private async getAssetsForChain(
    chain: ChainType,
    walletAddress: string,
  ): Promise<IPortfolioAsset[]> {
    const assets: IPortfolioAsset[] = [];

    if (chain === 'solana') {
      const nativeBalance = await this.tokenBalanceReader.getSolanaNativeBalance(walletAddress);

      const nativeDecimals = 9;

      assets.push({
        chain,
        symbol: 'SOL',
        address: 'So11111111111111111111111111111111111112',
        decimals: nativeDecimals,
        balanceBaseUnits: nativeBalance,
        balanceFormatted: this.formatBalance(nativeBalance, nativeDecimals),
        estimatedUsd: DEFAULT_ESTIMATED_USD,
      });

      return assets;
    }

    const nativeBalance = await this.tokenBalanceReader.getEvmNativeBalance(walletAddress, chain);

    const nativeDecimals = 18;
    const nativeSymbol = this.getNativeSymbol(chain);

    assets.push({
      chain,
      symbol: nativeSymbol,
      address: this.getNativeAddress(chain),
      decimals: nativeDecimals,
      balanceBaseUnits: nativeBalance,
      balanceFormatted: this.formatBalance(nativeBalance, nativeDecimals),
      estimatedUsd: DEFAULT_ESTIMATED_USD,
    });

    return assets;
  }

  private getNativeSymbol(chain: ChainType): string {
    const symbols: Record<ChainType, string> = {
      ethereum: 'ETH',
      arbitrum: 'ARB',
      base: 'ETH',
      optimism: 'OP',
      solana: 'SOL',
    };

    return symbols[chain];
  }

  private getNativeAddress(chain: ChainType): string {
    const addresses: Record<ChainType, string> = {
      ethereum: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      arbitrum: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      base: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      optimism: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      solana: 'So11111111111111111111111111111111111112',
    };

    return addresses[chain];
  }

  private formatBalance(balanceBaseUnits: string, decimals: number): string {
    const balance = Number.parseFloat(balanceBaseUnits) / BALANCE_BASE ** decimals;

    if (balance < MIN_DISPLAY_BALANCE) {
      return balance.toExponential(2);
    }

    return balance.toFixed(BALANCE_DECIMAL_PLACES);
  }

  private calculateTotalUsd(assets: readonly IPortfolioAsset[]): string {
    let total = 0;

    for (const asset of assets) {
      if (asset.estimatedUsd) {
        total += Number.parseFloat(asset.estimatedUsd);
      }
    }

    if (total === 0) {
      return '$0.00';
    }

    return `$${total.toFixed(2)}`;
  }

  private sortAssets(assets: IPortfolioAsset[]): IPortfolioAsset[] {
    return [...assets].sort((a, b) => {
      if (a.estimatedUsd === null && b.estimatedUsd === null) {
        return 0;
      }

      if (a.estimatedUsd === null) {
        return 1;
      }

      if (b.estimatedUsd === null) {
        return -1;
      }

      return Number.parseFloat(b.estimatedUsd) - Number.parseFloat(a.estimatedUsd);
    });
  }
}
