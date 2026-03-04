import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AGGREGATORS_TOKEN } from '../aggregators/aggregators.constants';
import type { IWalletConnectSession } from './interfaces/wallet-connect.interface';
import {
  buildSolanaExplorerUrl,
  getRequiredLastValidBlockHeight,
} from './wallet-connect.phantom.helpers';
import type { IAggregator, ISwapTransaction } from '../aggregators/interfaces/aggregator.interface';
import { SolanaChain } from '../chains/solana/solana.chain';
import { BusinessException } from '../common/exceptions/business.exception';

@Injectable()
export class WalletConnectPhantomTransactionService {
  public constructor(
    private readonly configService: ConfigService,
    private readonly solanaChain: SolanaChain,
    @Inject(AGGREGATORS_TOKEN) private readonly aggregators: readonly IAggregator[],
  ) {}

  public async buildSwapTransaction(
    session: IWalletConnectSession,
    walletAddress: string,
  ): Promise<ISwapTransaction> {
    const swapPayload = session.swapPayload;

    if (!swapPayload) {
      throw new BusinessException('Solana swap payload is not initialized');
    }

    const aggregator = this.aggregators.find(
      (candidateAggregator) => candidateAggregator.name === swapPayload.aggregatorName,
    );

    if (!aggregator) {
      throw new BusinessException(
        `Aggregator ${swapPayload.aggregatorName} is not available for swap`,
      );
    }

    return aggregator.buildSwapTransaction({
      chain: swapPayload.chain,
      sellTokenAddress: swapPayload.sellTokenAddress,
      buyTokenAddress: swapPayload.buyTokenAddress,
      sellAmountBaseUnits: swapPayload.sellAmountBaseUnits,
      sellTokenDecimals: swapPayload.sellTokenDecimals,
      buyTokenDecimals: swapPayload.buyTokenDecimals,
      fromAddress: walletAddress,
      slippagePercentage: swapPayload.slippagePercentage,
      feeConfig: swapPayload.executionFee,
    });
  }

  public async broadcastSignedTransaction(
    session: IWalletConnectSession,
    signedTransaction: Uint8Array,
  ): Promise<{ explorerUrl: string; transactionHash: string }> {
    const transactionHash = await this.solanaChain.broadcastSignedTransaction(
      signedTransaction,
      getRequiredLastValidBlockHeight(session),
    );
    const explorerUrl = buildSolanaExplorerUrl(this.configService, transactionHash);

    return {
      explorerUrl,
      transactionHash,
    };
  }
}
