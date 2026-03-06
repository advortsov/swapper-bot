import { Inject, Injectable } from '@nestjs/common';

import { CHAINS_TOKEN, type IChainsCollection } from '../chains/chains.constants';
import type { ChainType, ITransactionReceipt } from '../chains/interfaces/chain.interface';

@Injectable()
export class TransactionStatusService {
  public constructor(@Inject(CHAINS_TOKEN) private readonly chains: IChainsCollection) {}

  public async checkStatus(chain: ChainType, hash: string): Promise<ITransactionReceipt | null> {
    const chainInstance = this.chains.find((c) => c.name === chain);

    if (!chainInstance) {
      return null;
    }

    return chainInstance.getTransactionReceipt(hash);
  }
}
