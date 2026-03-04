import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { IWalletConnectSession } from './interfaces/wallet-connect.interface';
import { WalletConnectApprovalRegistry } from './wallet-connect.approval-registry';
import { WalletConnectApprovedSessionService } from './wallet-connect.approved-session.service';
import {
  getWalletConnectErrorWithLog,
  waitForWalletConnectApproval,
} from './wallet-connect.evm.helpers';
import { handleWalletConnectSessionError } from './wallet-connect.execution';
import { WalletConnectSessionStore } from './wallet-connect.session-store';
import { BusinessException } from '../common/exceptions/business.exception';
import { SwapExecutionAuditService } from '../swap/swap-execution-audit.service';

@Injectable()
export class WalletConnectLifecycleService {
  private readonly logger = new Logger(WalletConnectLifecycleService.name);
  private readonly telegramBotToken: string;

  @Inject()
  private readonly swapExecutionAuditService!: SwapExecutionAuditService;

  public constructor(
    private readonly approvalRegistry: WalletConnectApprovalRegistry,
    private readonly approvedSessionService: WalletConnectApprovedSessionService,
    private readonly configService: ConfigService,
    private readonly sessionStore: WalletConnectSessionStore,
  ) {
    this.telegramBotToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
  }

  public async handle(sessionId: string): Promise<void> {
    const session = this.sessionStore.get(sessionId);

    if (!session) {
      return;
    }

    try {
      const approvalCallback = this.approvalRegistry.get(sessionId);

      if (!approvalCallback) {
        throw new BusinessException('WalletConnect approval promise is not available');
      }

      const approvedSession = await waitForWalletConnectApproval(
        approvalCallback,
        session.expiresAt,
      );
      await this.approvedSessionService.handleApprovedSession(session, approvedSession);
    } catch (error: unknown) {
      const message = this.getErrorMessage(error);
      this.logger.error(`WalletConnect flow failed: ${message}`);
      await this.handleSessionError(session, message);
    } finally {
      this.sessionStore.delete(sessionId);
      this.approvalRegistry.delete(sessionId);
    }
  }

  private async handleSessionError(session: IWalletConnectSession, message: string): Promise<void> {
    await handleWalletConnectSessionError({
      deps: {
        logger: this.logger,
        swapExecutionAuditService: this.swapExecutionAuditService,
        telegramBotToken: this.telegramBotToken,
      },
      message,
      session,
    });
  }

  private getErrorMessage(error: unknown): string {
    return getWalletConnectErrorWithLog(error, this.logger);
  }
}
