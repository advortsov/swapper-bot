import { formatAmount, formatPair, formatTxHash } from './telegram.message-formatters.shared';
import type { ChainType } from '../chains/interfaces/chain.interface';
import type { IFavoritePairView } from '../favorites/interfaces/favorite-pair.interface';
import type { ISwapHistoryItem } from '../history/interfaces';
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
      `🧾 Tx: ${formatTxHash(item.txHash)}`,
    );
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

export type { IFavoriteViewItem };
