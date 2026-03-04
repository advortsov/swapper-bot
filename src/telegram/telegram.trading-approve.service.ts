import { Injectable } from '@nestjs/common';
import type { Context } from 'telegraf';

import { TelegramConnectionsService } from './telegram.connections.service';
import { buildApproveOptionsMessage } from './telegram.message-formatters';
import { TelegramTradingButtonsService } from './telegram.trading-buttons.service';
import type { IApproveCallbackPayload } from './telegram.trading-parser.service';
import { AllowanceService } from '../allowance/allowance.service';
import type { ChainType } from '../chains/interfaces/chain.interface';
import { WalletConnectService } from '../wallet-connect/wallet-connect.service';

@Injectable()
export class TelegramTradingApproveService {
  public constructor(
    private readonly walletConnectService: WalletConnectService,
    private readonly allowanceService: AllowanceService,
    private readonly telegramTradingButtonsService: TelegramTradingButtonsService,
  ) {}

  public async handleApprove(
    context: Context,
    userId: string,
    command: {
      amount: string;
      tokenInput: string;
      chain: ChainType;
      explicitChain: boolean;
    },
  ): Promise<void> {
    const walletAddress =
      this.walletConnectService.getReusableSession(userId, command.chain)?.address ?? null;
    const result = await this.allowanceService.prepareApproveOptions({
      userId,
      amount: command.amount,
      tokenInput: command.tokenInput,
      chain: command.chain,
      explicitChain: command.explicitChain,
      walletAddress,
    });

    await context.reply(buildApproveOptionsMessage(result), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: this.telegramTradingButtonsService.buildApproveButtons(
          result.actionToken,
          result.options,
        ),
      },
    });
  }

  public async handleApproveCallback(
    context: Context,
    userId: string,
    callbackPayload: IApproveCallbackPayload,
    connectionsService: TelegramConnectionsService,
  ): Promise<void> {
    const prepared = this.allowanceService.getPreparedApproveExecution(
      userId,
      callbackPayload.actionToken,
      callbackPayload.aggregatorName,
      callbackPayload.mode,
    );

    await context.answerCbQuery('Подготовка approve...');
    const session = await this.walletConnectService.createApproveSession({
      userId,
      approvalPayload: this.allowanceService.toWalletConnectApprovalPayload(prepared),
    });
    await connectionsService.replyApproveSession(
      context,
      this.allowanceService.toApproveSessionResponse({
        prepared,
        session,
      }),
    );
  }
}
