import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  IPhantomSessionState,
  IWalletConnectSession,
} from './interfaces/wallet-connect.interface';
import { buildPhantomSignTransactionUrl } from './wallet-connect.phantom.helpers';
import { WalletConnectSessionStore } from './wallet-connect.session-store';
import type { ISwapTransaction } from '../aggregators/interfaces/aggregator.interface';

@Injectable()
export class WalletConnectPhantomLinksService {
  public constructor(
    private readonly configService: ConfigService,
    private readonly sessionStore: WalletConnectSessionStore,
  ) {}

  public buildSignTransactionUrl(
    session: IWalletConnectSession,
    transaction: ISwapTransaction,
    phantomState: IPhantomSessionState,
  ): string {
    return buildPhantomSignTransactionUrl({
      configService: this.configService,
      session,
      transaction,
      phantomState,
      sessionStore: this.sessionStore,
    });
  }
}
