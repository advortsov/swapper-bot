import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import { AGGREGATORS_TOKEN } from '../aggregators/aggregators.constants';
import type { IAggregator, ISwapTransaction } from '../aggregators/interfaces/aggregator.interface';
import { AllowanceService } from '../allowance/allowance.service';
import type { ICreateWalletConnectApproveSessionInput } from './interfaces/wallet-connect.interface';
import type {
  IWalletConnectionSession,
  IWalletConnectSessionPublic,
  IWalletConnectSwapPayload,
} from './interfaces/wallet-connect.interface';
import { WalletConnectClientService } from './wallet-connect.client.service';
import {
  escapeWalletConnectHtml,
  getWalletConnectErrorWithLog,
  requestWalletConnectExecution,
  sendWalletConnectTelegramMessage,
} from './wallet-connect.evm.helpers';
import { executeWalletConnectApprove, executeWalletConnectSwap } from './wallet-connect.execution';
import type { ChainType } from '../chains/interfaces/chain.interface';
import { SwapExecutionAuditService } from '../swap/swap-execution-audit.service';
import { TransactionTrackerService } from '../transactions/transaction-tracker.service';

@Injectable()
export class WalletConnectConnectedWalletService {
  private readonly logger = new Logger(WalletConnectConnectedWalletService.name);
  private readonly telegramBotToken: string;

  @Inject(AGGREGATORS_TOKEN)
  private readonly aggregators!: readonly IAggregator[];

  @Inject()
  private readonly allowanceService!: AllowanceService;

  public constructor(
    private readonly clientService: WalletConnectClientService,
    private readonly configService: ConfigService,
    private readonly swapExecutionAuditService: SwapExecutionAuditService,
    private readonly transactionTrackerService: TransactionTrackerService,
  ) {
    this.telegramBotToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
  }

  public createConnectedWalletConnectResponse(
    connection: IWalletConnectionSession,
  ): IWalletConnectSessionPublic {
    return this.buildConnectedWalletSessionPublic(connection.expiresAt);
  }

  public createConnectedWalletSwapResponse(input: {
    connection: IWalletConnectionSession;
    swapPayload: IWalletConnectSwapPayload;
  }): IWalletConnectSessionPublic {
    void executeWalletConnectSwap({
      deps: this.getExecutionDependencies(),
      topic: input.connection.topic ?? '',
      userId: input.connection.userId,
      walletAddress: input.connection.address,
      swapPayload: input.swapPayload,
    });

    return this.buildConnectedWalletSessionPublic(input.connection.expiresAt);
  }

  public createConnectedWalletApproveResponse(input: {
    connection: IWalletConnectionSession;
    approvalPayload: ICreateWalletConnectApproveSessionInput['approvalPayload'];
  }): IWalletConnectSessionPublic {
    void this.executeApprovalOverConnection(input.connection, input.approvalPayload);

    return this.buildConnectedWalletSessionPublic(input.connection.expiresAt);
  }

  private buildConnectedWalletSessionPublic(expiresAt: number): IWalletConnectSessionPublic {
    return {
      sessionId: randomUUID(),
      uri: null,
      expiresAt: new Date(expiresAt).toISOString(),
      walletDelivery: 'connected-wallet',
    };
  }

  private async executeApprovalOverConnection(
    connection: IWalletConnectionSession,
    approvalPayload: ICreateWalletConnectApproveSessionInput['approvalPayload'],
  ): Promise<void> {
    try {
      await executeWalletConnectApprove({
        approvalPayload,
        deps: this.getExecutionDependencies(),
        successTitle: 'Approve отправлен в подключённый кошелёк',
        topic: connection.topic ?? '',
        userId: connection.userId,
        walletAddress: connection.address,
      });
    } catch (error: unknown) {
      await sendWalletConnectTelegramMessage({
        telegramBotToken: this.telegramBotToken,
        chatId: connection.userId,
        text: `❌ <b>Ошибка:</b> ${escapeWalletConnectHtml(this.getErrorMessage(error))}`,
        logger: this.logger,
      });
    }
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

  private getErrorMessage(error: unknown): string {
    return getWalletConnectErrorWithLog(error, this.logger);
  }
}
