import type { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { formatUnits } from 'viem';

import type {
  IWalletConnectSession,
  IWalletConnectSwapPayload,
} from './interfaces/wallet-connect.interface';
import { buildWalletExplorerUrl } from './wallet-connect.evm.helpers';
import {
  escapeWalletConnectHtml,
  getWalletConnectErrorWithLog,
} from './wallet-connect.evm.helpers';
import {
  buildSwapTransactionForPayload,
  resolveWalletConnectAggregator,
  sendWalletConnectTelegramMessage,
} from './wallet-connect.evm.helpers';
import type { IAggregator, ISwapTransaction } from '../aggregators/interfaces/aggregator.interface';
import { type AllowanceService } from '../allowance/allowance.service';
import { InsufficientAllowanceException } from '../allowance/insufficient-allowance.exception';
import type { IWalletConnectApprovalPayload } from '../allowance/interfaces/allowance.interface';
import type { ChainType } from '../chains/interfaces/chain.interface';
import type { SwapExecutionAuditService } from '../swap/swap-execution-audit.service';
import type { TransactionTrackerService } from '../transactions/transaction-tracker.service';

interface IWalletConnectExecutionDeps {
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
  transactionTracker?: TransactionTrackerService;
}

export async function executeWalletConnectApprove(input: {
  approvalPayload: IWalletConnectApprovalPayload;
  deps: IWalletConnectExecutionDeps;
  successTitle: string;
  topic: string;
  userId: string;
  walletAddress: string;
}): Promise<void> {
  const { approvalPayload, deps, successTitle, topic, userId, walletAddress } = input;
  const transaction = deps.allowanceService.buildApproveTransaction(approvalPayload);
  const transactionHash = await deps.requestWalletExecution(
    topic,
    approvalPayload.chain,
    walletAddress,
    {
      kind: 'evm',
      to: transaction.to,
      data: transaction.data,
      value: transaction.value,
    },
  );
  const explorerUrl = buildWalletExplorerUrl(
    deps.configService,
    approvalPayload.chain,
    transactionHash,
  );

  await sendWalletConnectTelegramMessage({
    telegramBotToken: deps.telegramBotToken,
    chatId: userId,
    text: [
      `✅ <b>${successTitle}</b>`,
      '',
      `🌐 Сеть: <code>${escapeWalletConnectHtml(approvalPayload.chain)}</code>`,
      `🪙 Токен: <code>${escapeWalletConnectHtml(approvalPayload.tokenSymbol)}</code>`,
      `🏆 Агрегатор: <code>${escapeWalletConnectHtml(approvalPayload.aggregatorName)}</code>`,
      `🧾 Tx: <code>${escapeWalletConnectHtml(transactionHash)}</code>`,
      `<a href="${escapeWalletConnectHtml(explorerUrl)}">Открыть в эксплорере</a>`,
      '',
      'ℹ️ После подтверждения approve повтори /swap.',
    ].join('\n'),
    logger: deps.logger,
  });
}

export async function notifyConnectedWallet(input: {
  chainFamily: 'EVM' | 'Solana';
  logger: Logger;
  telegramBotToken: string;
  userId: string;
  walletAddress: string;
}): Promise<void> {
  await sendWalletConnectTelegramMessage({
    telegramBotToken: input.telegramBotToken,
    chatId: input.userId,
    text: [
      '👛 <b>Кошелёк подключён</b>',
      '',
      `🌐 Семейство: <code>${input.chainFamily}</code>`,
      `🆔 Адрес: <code>${escapeWalletConnectHtml(input.walletAddress)}</code>`,
    ].join('\n'),
    logger: input.logger,
  });
}

export async function executeWalletConnectSwap(input: {
  deps: IWalletConnectExecutionDeps;
  topic: string;
  userId: string;
  walletAddress: string;
  swapPayload: IWalletConnectSwapPayload;
}): Promise<void> {
  const { deps, swapPayload, topic, userId, walletAddress } = input;

  try {
    await deps.allowanceService.ensureSufficientAllowance({
      userId,
      chain: swapPayload.chain,
      aggregatorName: swapPayload.aggregatorName,
      walletAddress,
      tokenSymbol: swapPayload.fromSymbol,
      tokenAddress: swapPayload.sellTokenAddress,
      tokenDecimals: swapPayload.sellTokenDecimals,
      buyTokenAddress: swapPayload.buyTokenAddress,
      amount: formatSellAmount(swapPayload.sellAmountBaseUnits, swapPayload.sellTokenDecimals),
      amountBaseUnits: swapPayload.sellAmountBaseUnits,
    });
    const aggregator = resolveWalletConnectAggregator(deps.aggregators, swapPayload.aggregatorName);
    const transaction = await buildSwapTransactionForPayload(
      swapPayload,
      aggregator,
      walletAddress,
    );
    const transactionHash = await deps.requestWalletExecution(
      topic,
      swapPayload.chain,
      walletAddress,
      transaction,
    );
    await deps.swapExecutionAuditService.markSuccess(
      swapPayload.executionId,
      swapPayload.aggregatorName,
      swapPayload.feeMode,
      transactionHash,
    );
    if (deps.transactionTracker) {
      await deps.transactionTracker.track({
        hash: transactionHash,
        chain: swapPayload.chain,
        userId,
        executionId: swapPayload.executionId,
      });
    }
    await sendSwapSuccessMessage(deps, userId, swapPayload, transactionHash);
  } catch (error: unknown) {
    if (error instanceof InsufficientAllowanceException) {
      await handleInsufficientAllowanceError(deps, userId, swapPayload, error);
      return;
    }

    const message = getWalletConnectErrorWithLog(error, deps.logger);
    await deps.swapExecutionAuditService.markError(
      swapPayload.executionId,
      swapPayload.aggregatorName,
      swapPayload.feeMode,
      message,
    );
    await sendWalletConnectTelegramMessage({
      telegramBotToken: deps.telegramBotToken,
      chatId: userId,
      text: `❌ <b>Ошибка:</b> ${escapeWalletConnectHtml(message)}`,
      logger: deps.logger,
    });
  }
}

export async function handleWalletConnectSessionError(input: {
  deps: Pick<
    IWalletConnectExecutionDeps,
    'logger' | 'swapExecutionAuditService' | 'telegramBotToken'
  >;
  message: string;
  session: IWalletConnectSession;
}): Promise<void> {
  const { deps, message, session } = input;
  const swapPayload = session.swapPayload;

  if (swapPayload) {
    await deps.swapExecutionAuditService.markError(
      swapPayload.executionId,
      swapPayload.aggregatorName,
      swapPayload.feeMode,
      message,
    );
  }

  await sendWalletConnectTelegramMessage({
    telegramBotToken: deps.telegramBotToken,
    chatId: session.userId,
    text: `❌ <b>Ошибка:</b> ${escapeWalletConnectHtml(message)}`,
    logger: deps.logger,
  });
}

function formatSellAmount(amountBaseUnits: string, decimals: number): string {
  return formatUnits(BigInt(amountBaseUnits), decimals);
}

async function sendSwapSuccessMessage(
  deps: IWalletConnectExecutionDeps,
  userId: string,
  swapPayload: IWalletConnectSwapPayload,
  transactionHash: string,
): Promise<void> {
  const explorerUrl = buildWalletExplorerUrl(
    deps.configService,
    swapPayload.chain,
    transactionHash,
  );

  await sendWalletConnectTelegramMessage({
    telegramBotToken: deps.telegramBotToken,
    chatId: userId,
    text: [
      '✅ <b>Своп отправлен</b>',
      '',
      `🌐 Сеть: <code>${escapeWalletConnectHtml(swapPayload.chain)}</code>`,
      `🏆 Агрегатор: <code>${escapeWalletConnectHtml(swapPayload.aggregatorName)}</code>`,
      `🧾 Tx: <code>${escapeWalletConnectHtml(transactionHash)}</code>`,
      `<a href="${escapeWalletConnectHtml(explorerUrl)}">Открыть в эксплорере</a>`,
    ].join('\n'),
    logger: deps.logger,
  });
}

async function handleInsufficientAllowanceError(
  deps: IWalletConnectExecutionDeps,
  userId: string,
  swapPayload: IWalletConnectSwapPayload,
  error: InsufficientAllowanceException,
): Promise<void> {
  await deps.swapExecutionAuditService.markError(
    swapPayload.executionId,
    swapPayload.aggregatorName,
    swapPayload.feeMode,
    error.message,
  );
  await sendWalletConnectTelegramMessage({
    telegramBotToken: deps.telegramBotToken,
    chatId: userId,
    text: [
      '⚠️ <b>Перед свопом нужен approve</b>',
      '',
      `🌐 Сеть: <code>${escapeWalletConnectHtml(error.data.chain)}</code>`,
      `🪙 Токен: <code>${escapeWalletConnectHtml(error.data.tokenSymbol)}</code>`,
      `🏆 Агрегатор: <code>${escapeWalletConnectHtml(error.data.aggregatorName)}</code>`,
      `📦 Требуется: <code>${escapeWalletConnectHtml(error.data.amount)}</code>`,
      `🧾 Текущий allowance: <code>${escapeWalletConnectHtml(error.data.currentAllowance)}</code>`,
      `🔐 Spender: <code>${escapeWalletConnectHtml(error.data.spenderAddress)}</code>`,
      '',
      'ℹ️ Выбери approve ниже и потом повтори /swap.',
    ].join('\n'),
    replyMarkup: {
      inline_keyboard: [
        [
          {
            text: 'Approve exact',
            callback_data: deps.allowanceService.buildApprovalCallbackData(
              error.data.actionToken,
              error.data.aggregatorName,
              'exact',
            ),
          },
          {
            text: 'Approve max',
            callback_data: deps.allowanceService.buildApprovalCallbackData(
              error.data.actionToken,
              error.data.aggregatorName,
              'max',
            ),
          },
        ],
      ],
    },
    logger: deps.logger,
  });
}
