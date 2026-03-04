import {
  buildProviderQuoteLine,
  buildSwapRouteLine,
  formatAmount,
  formatChainCode,
  formatFee,
  formatGas,
  formatPair,
} from './telegram.message-formatters.shared';
import type {
  IApproveOptionsResponse,
  IApproveSessionResponse,
} from '../allowance/interfaces/allowance.interface';
import type { ChainType } from '../chains/interfaces/chain.interface';
import type { IPriceResponse, IProviderQuote } from '../price/interfaces/price.interface';
import type { ISwapQuotesResponse, ISwapSessionResponse } from '../swap/interfaces/swap.interface';
import { escapeHtml } from '../wallet-connect/wallet-connect.utils';

export function buildPriceMessage(result: IPriceResponse): string {
  return [
    '📈 <b>Лучшая котировка</b>',
    '',
    `🔁 ${formatPair(result.fromAmount, result.fromSymbol, result.toAmount, result.toSymbol)}`,
    `🌐 Сеть: ${formatChainCode(result.chain)}`,
    `🏆 Лучший агрегатор: <code>${escapeHtml(result.aggregator)}</code>`,
    '',
    `💸 Gross: ${formatAmount(result.grossToAmount, result.toSymbol)}`,
    `🤖 Комиссия бота: ${formatFee(result.feeAmount, result.feeAmountSymbol ?? result.toSymbol, result.feeBps, result.feeDisplayLabel)}`,
    `✅ Net: ${formatAmount(result.toAmount, result.toSymbol)}`,
    `⛽ Газ: ${formatGas(result.estimatedGasUsd)}`,
    `📊 Провайдеров опрошено: ${result.providersPolled}`,
    '',
    '<b>Котировки провайдеров</b>',
    ...result.providerQuotes.map((quote) => buildProviderQuoteLine(quote, result.toSymbol)),
  ].join('\n');
}

export function buildSwapQuotesMessage(
  quotes: ISwapQuotesResponse,
  swapValidityText: string,
): string {
  return [
    '🔁 <b>Своп подготовлен к выбору маршрута</b>',
    '',
    `🔁 ${formatPair(quotes.fromAmount, quotes.fromSymbol, quotes.toAmount, quotes.toSymbol)}`,
    `🌐 Сеть: ${formatChainCode(quotes.chain)}`,
    `🏆 Лучший агрегатор: <code>${escapeHtml(quotes.aggregator)}</code>`,
    '',
    `💸 Gross: ${formatAmount(quotes.grossToAmount, quotes.toSymbol)}`,
    `🤖 Комиссия бота: ${formatFee(quotes.feeAmount, quotes.feeAmountSymbol ?? quotes.toSymbol, quotes.feeBps, quotes.feeDisplayLabel)}`,
    `✅ Net: ${formatAmount(quotes.toAmount, quotes.toSymbol)}`,
    `⏳ Срок актуальности: ${escapeHtml(swapValidityText)}`,
    `📊 Провайдеров опрошено: ${quotes.providersPolled}`,
    '',
    'ℹ️ Итоговая транзакция будет собрана уже с учётом комиссии бота.',
    '',
    '<b>Доступные маршруты</b>',
    ...quotes.providerQuotes.map((quote) =>
      buildSwapRouteLine(quote, quotes.toSymbol, quotes.aggregator),
    ),
    '',
    'ℹ️ Выбери агрегатор кнопкой ниже.',
  ].join('\n');
}

export function buildSwapButtonText(
  quote: IProviderQuote,
  toSymbol: string,
  bestAggregator: string,
): string {
  const prefix = quote.aggregator === bestAggregator ? '⭐ ' : '';
  return `${prefix}${escapeHtml(quote.aggregator)} · ${escapeHtml(quote.toAmount)} ${escapeHtml(toSymbol)}`;
}

export function buildApproveOptionsMessage(input: IApproveOptionsResponse): string {
  return [
    '🛡️ <b>Approve для токена</b>',
    '',
    `🪙 Токен: <code>${escapeHtml(input.tokenSymbol)}</code>`,
    `🌐 Сеть: ${formatChainCode(input.chain)}`,
    `📦 Сумма: <code>${escapeHtml(input.amount)}</code>`,
    `👛 Кошелёк: ${input.walletAddress ? `<code>${escapeHtml(input.walletAddress)}</code>` : 'будет определён после подключения'}`,
    '',
    '<b>Доступные spender-цели</b>',
    ...input.options.map((option) =>
      [
        `• <code>${escapeHtml(option.aggregatorName)}</code>`,
        `  🔐 Spender: <code>${escapeHtml(option.spenderAddress)}</code>`,
        `  📏 Allowance: <code>${escapeHtml(option.currentAllowance ?? 'неизвестно')}</code>`,
      ].join('\n'),
    ),
    '',
    'ℹ️ Выбери approve exact или approve max кнопками ниже.',
  ].join('\n');
}

export function buildPreparedApproveMessage(input: {
  session: IApproveSessionResponse;
  deliveryHint: string;
  expiryText: string;
}): string {
  const { deliveryHint, expiryText, session } = input;

  return [
    '🛡️ <b>Approve подготовлен</b>',
    '',
    `🪙 Токен: <code>${escapeHtml(session.tokenSymbol)}</code>`,
    `🌐 Сеть: ${formatChainCode(session.chain)}`,
    `🏆 Агрегатор: <code>${escapeHtml(session.aggregatorName)}</code>`,
    `📦 Сумма: <code>${escapeHtml(session.amount)}</code>`,
    `📏 Текущий allowance: <code>${escapeHtml(session.currentAllowance ?? 'неизвестно')}</code>`,
    `🔐 Spender: <code>${escapeHtml(session.spenderAddress)}</code>`,
    `⚙️ Режим: <code>${escapeHtml(session.mode)}</code>`,
    '',
    `🆔 Session ID: <code>${escapeHtml(session.sessionId)}</code>`,
    `⏳ На подтверждение: <code>${escapeHtml(expiryText)}</code>`,
    '',
    `ℹ️ ${escapeHtml(deliveryHint)}`,
  ].join('\n');
}

export function buildPreparedSwapMessage(input: {
  session: ISwapSessionResponse;
  swapValidityText: string;
  deliveryHint: string;
}): string {
  const { deliveryHint, session, swapValidityText } = input;

  return [
    '👛 <b>Своп подготовлен</b>',
    '',
    `🔁 ${formatPair(session.fromAmount, session.fromSymbol, session.toAmount, session.toSymbol)}`,
    `🌐 Сеть: ${formatChainCode(session.chain)}`,
    `🏆 Агрегатор: <code>${escapeHtml(session.aggregator)}</code>`,
    '',
    `💸 Gross: ${formatAmount(session.grossToAmount, session.toSymbol)}`,
    `🤖 Комиссия бота: ${formatAmount(session.feeAmount, session.feeAmountSymbol ?? session.toSymbol)}`,
    `✅ Net: ${formatAmount(session.toAmount, session.toSymbol)}`,
    '',
    `🆔 Session ID: <code>${escapeHtml(session.sessionId)}</code>`,
    `⏳ На подтверждение: <code>${escapeHtml(swapValidityText)}</code>`,
    '',
    'ℹ️ Транзакция уже собрана с учётом комиссии бота.',
    `ℹ️ ${escapeHtml(deliveryHint)}`,
  ].join('\n');
}

export function buildQrCaption(
  kind: 'connect' | 'swap' | 'approve',
  chain: ChainType,
  sessionId: string,
  ttlText: string,
): string {
  const mainText =
    kind === 'connect'
      ? chain === 'solana'
        ? 'ℹ️ Отсканируй QR в Phantom для подключения.'
        : 'ℹ️ Отсканируй QR в MetaMask или Trust Wallet для подключения.'
      : kind === 'approve'
        ? 'ℹ️ Отсканируй QR в EVM-кошельке для approve.'
        : chain === 'solana'
          ? 'ℹ️ Отсканируй QR в Phantom для подписи.'
          : 'ℹ️ Отсканируй QR в EVM-кошельке для подтверждения.';

  return [
    mainText,
    `🆔 Session ID: <code>${escapeHtml(sessionId)}</code>`,
    kind === 'swap' || kind === 'approve'
      ? `⏳ На подтверждение: <code>${escapeHtml(ttlText)}</code>`
      : `⏳ Сессия истекает: <code>${escapeHtml(ttlText)}</code>`,
  ].join('\n');
}
