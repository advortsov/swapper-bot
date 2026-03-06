import { formatAmount, formatPair, formatTxHash } from './telegram.message-formatters.shared';
import type { ChainType } from '../chains/interfaces/chain.interface';
import type { IFavoritePairView } from '../favorites/interfaces/favorite-pair.interface';
import type { ISwapHistoryItem } from '../history/interfaces';
import type { ITrackedTransaction } from '../transactions/interfaces/transaction-tracker.interface';
import { escapeHtml } from '../wallet-connect/wallet-connect.utils';

interface IFavoriteViewItem {
  favorite: IFavoritePairView;
  currentNetText: string;
  bestAggregator: string;
  alertText: string;
}

export function buildFavoritesMessage(items: readonly IFavoriteViewItem[]): string {
  if (items.length === 0) {
    return '⭐ <b>Избранных пар пока нет.</b>\nСохрани пару кнопкой из <code>/price</code> или <code>/swap</code>.';
  }

  const lines = ['⭐ <b>Избранные пары</b>'];

  for (const [index, item] of items.entries()) {
    lines.push(
      '',
      `<b>${index + 1}) ${formatPair(item.favorite.amount, item.favorite.fromTokenSymbol, item.currentNetText, item.favorite.toTokenSymbol)}</b>`,
      `🌐 ${escapeHtml(item.favorite.chain)}`,
      `✅ Текущий net: ${formatAmount(item.currentNetText, item.favorite.toTokenSymbol)}`,
      `🏆 Лучший агрегатор: <code>${escapeHtml(item.bestAggregator)}</code>`,
      `🔔 Алерт: ${escapeHtml(item.alertText)}`,
    );
  }

  return lines.join('\n');
}

export function buildFavoriteQuoteMessage(input: {
  amount: string;
  fromSymbol: string;
  toSymbol: string;
  chain: ChainType;
  currentNet: string;
  bestAggregator: string;
  alertText: string;
}): string {
  return [
    '⭐ <b>Избранная пара</b>',
    '',
    `🔁 ${formatPair(input.amount, input.fromSymbol, input.currentNet, input.toSymbol)}`,
    `🌐 ${escapeHtml(input.chain)}`,
    `✅ Текущий net: ${formatAmount(input.currentNet, input.toSymbol)}`,
    `🏆 Лучший агрегатор: <code>${escapeHtml(input.bestAggregator)}</code>`,
    `🔔 Алерт: ${escapeHtml(input.alertText)}`,
  ].join('\n');
}

export function buildHistoryMessage(items: readonly ISwapHistoryItem[]): string {
  if (items.length === 0) {
    return '🕘 <b>История обменов пока пуста.</b>';
  }

  const lines = ['🕘 <b>Последние успешные обмены</b>'];

  for (const [index, item] of items.entries()) {
    lines.push(
      '',
      `<b>${index + 1}) ${formatPair(item.fromAmount, item.fromSymbol, item.toAmount, item.toSymbol)}</b>`,
      `🌐 ${escapeHtml(item.chain)}`,
      `🏆 <code>${escapeHtml(item.aggregator)}</code>`,
      `💸 Gross: ${formatAmount(item.grossToAmount, item.toSymbol)}`,
      `🤖 Fee: ${formatAmount(item.feeAmount, item.feeAmountSymbol ?? item.toSymbol)}`,
      `🕒 ${escapeHtml(item.executedAt ?? 'неизвестно')}`,
      `🧾 Tx: ${formatTxHash(item.txHash)}${item.explorerUrl ? ` <a href="${escapeHtml(item.explorerUrl)}">↗</a>` : ''}`,
    );

    if (item.transactionStatus) {
      lines.push(`📡 On-chain: ${escapeHtml(item.transactionStatus)}`);
    }

    if (item.gasUsed) {
      lines.push(`⛽ Gas: ${escapeHtml(item.gasUsed)}`);
    }
  }

  return lines.join('\n');
}

export function buildAlertPromptMessage(): string {
  return '🔔 Введи целевое количество to-токена. Алерт сработает при пересечении этого порога вверх или вниз.';
}

export function buildAlertCreatedMessage(input: {
  targetToAmount: string;
  toTokenSymbol: string;
  amount: string;
  fromTokenSymbol: string;
}): string {
  return `✅ Алерт установлен: ${escapeHtml(input.targetToAmount)} ${escapeHtml(input.toTokenSymbol)} для ${escapeHtml(input.amount)} ${escapeHtml(input.fromTokenSymbol)} → ${escapeHtml(input.toTokenSymbol)}.`;
}

export function buildAlertTriggeredMessage(input: {
  chain: ChainType;
  amount: string;
  fromTokenSymbol: string;
  toTokenSymbol: string;
  targetToAmount: string;
  currentToAmount: string;
  aggregator: string;
}): string {
  return [
    '🔔 <b>Сработал алерт по курсу</b>',
    '',
    `🔁 ${formatPair(input.amount, input.fromTokenSymbol, input.currentToAmount, input.toTokenSymbol)}`,
    `🌐 ${escapeHtml(input.chain)}`,
    `🎯 Цель: ${formatAmount(input.targetToAmount, input.toTokenSymbol)}`,
    `✅ Текущий net: ${formatAmount(input.currentToAmount, input.toTokenSymbol)}`,
    `🏆 Лучший агрегатор: <code>${escapeHtml(input.aggregator)}</code>`,
  ].join('\n');
}

export function buildTransactionConfirmedMessage(data: {
  chain: ChainType;
  hash: string;
  blockNumber: string | null;
  gasUsed: string | null;
  effectiveGasPrice: string | null;
}): string {
  const lines = [
    '✅ <b>Транзакция подтверждена</b>',
    '',
    `🌐 Сеть: <code>${escapeHtml(data.chain)}</code>`,
    `🧾 Tx: <code>${escapeHtml(data.hash)}</code>`,
  ];

  if (data.blockNumber) {
    lines.push(`📦 Блок: ${escapeHtml(data.blockNumber)}`);
  }

  if (data.gasUsed) {
    lines.push(`⛽ Gas used: ${escapeHtml(data.gasUsed)}`);
  }

  if (data.effectiveGasPrice) {
    lines.push(`💰 Gas price: ${escapeHtml(data.effectiveGasPrice)}`);
  }

  return lines.join('\n');
}

export function buildTransactionFailedMessage(data: {
  chain: ChainType;
  hash: string;
  errorMessage: string;
}): string {
  return [
    '❌ <b>Транзакция не прошла</b>',
    '',
    `🌐 Сеть: <code>${escapeHtml(data.chain)}</code>`,
    `🧾 Tx: <code>${escapeHtml(data.hash)}</code>`,
    `⚠️ Ошибка: ${escapeHtml(data.errorMessage)}`,
  ].join('\n');
}

export function buildTransactionStatusMessage(tx: ITrackedTransaction): string {
  const statusMap: Record<string, { emoji: string; label: string }> = {
    confirmed: { emoji: '✅', label: 'Подтверждена' },
    failed: { emoji: '❌', label: 'Не прошла' },
  };
  const { emoji, label } = statusMap[tx.status] ?? { emoji: '⏳', label: 'В ожидании' };

  const lines = [
    `${emoji} <b>Статус транзакции: ${label}</b>`,
    '',
    `🌐 Сеть: <code>${escapeHtml(tx.chain)}</code>`,
    `🧾 Tx: <code>${escapeHtml(tx.hash)}</code>`,
    `🕒 Отправлена: ${escapeHtml(tx.submittedAt)}`,
  ];

  pushOptionalLine(lines, tx.confirmedAt, (v) => `✅ Подтверждена: ${escapeHtml(v)}`);
  pushOptionalLine(lines, tx.failedAt, (v) => `❌ Ошибка: ${escapeHtml(v)}`);
  pushOptionalLine(lines, tx.blockNumber, (v) => `📦 Блок: ${escapeHtml(v)}`);
  pushOptionalLine(lines, tx.gasUsed, (v) => `⛽ Gas used: ${escapeHtml(v)}`);
  pushOptionalLine(lines, tx.effectiveGasPrice, (v) => `💰 Gas price: ${escapeHtml(v)}`);
  pushOptionalLine(lines, tx.errorMessage, (v) => `⚠️ Ошибка: ${escapeHtml(v)}`);

  return lines.join('\n');
}

function pushOptionalLine(
  lines: string[],
  value: string | null,
  format: (v: string) => string,
): void {
  if (value) {
    lines.push(format(value));
  }
}

export type { IFavoriteViewItem };
