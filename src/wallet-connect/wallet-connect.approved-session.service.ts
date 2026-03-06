import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SessionTypes } from '@walletconnect/types';

import { AGGREGATORS_TOKEN } from '../aggregators/aggregators.constants';
import type { IAggregator, ISwapTransaction } from '../aggregators/interfaces/aggregator.interface';
import { AllowanceService } from '../allowance/allowance.service';
import type { ChainType } from '../chains/interfaces/chain.interface';
import { BusinessException } from '../common/exceptions/business.exception';
import { SwapExecutionAuditService } from '../swap/swap-execution-audit.service';
import { TransactionTrackerService } from '../transactions/transaction-tracker.service';
import type { IWalletConnectSession } from './interfaces/wallet-connect.interface';
import { WalletConnectClientService } from './wallet-connect.client.service';
import {
  extractWalletAddress,
  getWalletConnectSwapPayload,
  requestWalletConnectExecution,
  saveWalletConnection,
} from './wallet-connect.evm.helpers';
import {
  executeWalletConnectApprove,
  executeWalletConnectSwap,
  notifyConnectedWallet,
} from './wallet-connect.execution';
import { WalletConnectSessionStore } from './wallet-connect.session-store';

@Injectable()
export class WalletConnectApprovedSessionService {
  private readonly logger = new Logger(WalletConnectApprovedSessionService.name);
  private readonly telegramBotToken: string;

  @Inject(AGGREGATORS_TOKEN)
  private readonly aggregators!: readonly IAggregator[];

  @Inject()
  private readonly allowanceService!: AllowanceService;

  @Inject()
  private readonly transactionTrackerService!: TransactionTrackerService;

  public constructor(
    private readonly clientService: WalletConnectClientService,
    private readonly configService: ConfigService,
    private readonly sessionStore: WalletConnectSessionStore,
    private readonly swapExecutionAuditService: SwapExecutionAuditService,
  ) {
    this.telegramBotToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
  }

  public async handleApprovedSession(
    session: IWalletConnectSession,
    approvedSession: SessionTypes.Struct,
  ): Promise<void> {
    const walletAddress = extractWalletAddress(approvedSession, session.chain);
    const connection = saveWalletConnection({
      session,
      approvedSession,
      walletAddress,
    });
    this.sessionStore.saveConnection(connection);

    if (session.kind === 'connect') {
      await notifyConnectedWallet({
        chainFamily: session.family === 'solana' ? 'Solana' : 'EVM',
        logger: this.logger,
        telegramBotToken: this.telegramBotToken,
        userId: session.userId,
        walletAddress,
      });
      return;
    }

    if (session.kind === 'approve') {
      await this.executeApprovedApproval(session, approvedSession, walletAddress);
      return;
    }

    await executeWalletConnectSwap({
      deps: this.getExecutionDependencies(),
      topic: approvedSession.topic,
      userId: session.userId,
      walletAddress,
      swapPayload: getWalletConnectSwapPayload(session),
    });
  }

  private async executeApprovedApproval(
    session: IWalletConnectSession,
    approvedSession: SessionTypes.Struct,
    walletAddress: string,
  ): Promise<void> {
    const approvalPayload = session.approvalPayload;

    if (!approvalPayload) {
      throw new BusinessException(
        'Approve payload is not available for this WalletConnect session',
      );
    }

    await executeWalletConnectApprove({
      approvalPayload,
      deps: this.getExecutionDependencies(),
      successTitle: 'Approve отправлен',
      topic: approvedSession.topic,
      userId: session.userId,
      walletAddress,
    });
  }

  private getExecutionDependencies(): {
    allowanceService: AllowanceService;
    aggregators: readonly IAggregator[];
    configService: ConfigService;
    logger: Logger;
    requestWalletExecution: (
      topic: string,
      chain: ChainType,
      walletAddress: string,
      transaction: ISwapTransaction,
    ) => Promise<string>;
    swapExecutionAuditService: SwapExecutionAuditService;
    telegramBotToken: string;
    transactionTracker: TransactionTrackerService;
  } {
    return {
      allowanceService: this.allowanceService,
      aggregators: this.aggregators,
      configService: this.configService,
      logger: this.logger,
      requestWalletExecution: this.requestWalletExecution.bind(this),
      swapExecutionAuditService: this.swapExecutionAuditService,
      telegramBotToken: this.telegramBotToken,
      transactionTracker: this.transactionTrackerService,
    };
  }

  private async requestWalletExecution(
    topic: string,
    chain: ChainType,
    walletAddress: string,
    transaction: ISwapTransaction,
  ): Promise<string> {
    return requestWalletConnectExecution({
      signClient: await this.clientService.getClient(),
      topic,
      chain,
      walletAddress,
      transaction,
    });
  }
}
