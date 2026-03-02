import type { ChainType } from '../chains/interfaces/chain.interface';
import type { IFavoritePairView } from '../favorites/interfaces/favorite-pair.interface';
import type { ISwapHistoryItem } from '../history/interfaces';
import type { IPriceResponse, IProviderQuote } from '../price/interfaces/price.interface';
import type { ISwapQuotesResponse, ISwapSessionResponse } from '../swap/interfaces/swap.interface';
import type { IWalletConnectionStatus } from '../wallet-connect/interfaces/wallet-connect.interface';
import { escapeHtml } from '../wallet-connect/wallet-connect.utils';

const GAS_USD_PRECISION = 4;
const SHORT_HASH_PREFIX = 6;
const SHORT_HASH_SUFFIX = 4;

interface IFavoriteViewItem {
  favorite: IFavoritePairView;
  currentNetText: string;
  bestAggregator: string;
  alertText: string;
}

export function buildStartMessage(): string {
  return [
    '👋 <b>Привет!</b>',
    'Я помогу подобрать маршрут свопа и провести его через доступных агрегаторов.',
    'ℹ️ Полная справка по возможностям: <code>/help</code>',
  ].join('\n');
}

export function buildHelpMessage(): string {
  return [
    'ℹ️ <b>Справка по боту</b>',
    '',
    '<b>1. Котировки</b>',
    '<code>/price &lt;amount&gt; &lt;from&gt; to &lt;to&gt; [on &lt;chain&gt;]</code>',
    'Примеры:',
    '<code>/price 10 ETH to USDC</code>',
    '<code>/price 100 USDC to WETH on base</code>',
    '<code>/price 1 SOL to USDC on solana</code>',
    '',
    '<b>2. Свопы</b>',
    '<code>/swap &lt;amount&gt; &lt;from&gt; to &lt;to&gt; [on &lt;chain&gt;]</code>',
    'После команды бот покажет агрегаторов, gross, комиссию бота и net, а затем даст выбрать маршрут кнопкой.',
    'Примеры:',
    '<code>/swap 0.1 ETH to USDC</code>',
    '<code>/swap 0.1 ETH to USDC on arbitrum</code>',
    '<code>/swap 1 SOL to USDC on solana</code>',
    '',
    '<b>3. Адрес токена вместо символа</b>',
    'Если указываешь адрес токена, сеть обязательна.',
    '<code>/price 100 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 to USDT on ethereum</code>',
    '<code>/swap 1 SOL to EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v on solana</code>',
    '',
    '<b>4. Кошелёк</b>',
    '<code>/connect [on &lt;chain&gt;]</code>',
    '<code>/disconnect [on &lt;chain&gt;]</code>',
    'EVM-подключение общее для <code>ethereum</code>, <code>arbitrum</code>, <code>base</code> и <code>optimism</code>.',
    '',
    '<b>5. Избранное и алерты</b>',
    '<code>/favorites</code> — сохранённые пары, текущий курс, установка алерта, удаление.',
    'Кнопки после <code>/price</code> и <code>/swap</code>: ⭐ В избранное, 🔔 Алерт.',
    'Алерт одноразовый: срабатывает, когда лучший net достигает заданного порога.',
    '',
    '<b>6. История</b>',
    '<code>/history</code> — последние успешные обмены.',
    '',
    '<b>7. Настройки</b>',
    '<code>/settings</code> — slippage и предпочитаемый агрегатор.',
    '',
    '<b>Поддерживаемые сети</b>',
    '<code>ethereum</code>, <code>arbitrum</code>, <code>base</code>, <code>optimism</code>, <code>solana</code>',
  ].join('\n');
}

export function buildPriceMessage(result: IPriceResponse): string {
  return [
    '📈 <b>Лучшая котировка</b>',
    '',
    `🔁 ${formatPair(result.fromAmount, result.fromSymbol, result.toAmount, result.toSymbol)}`,
    `🌐 Сеть: <code>${escapeHtml(result.chain)}</code>`,
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
  quoteExpiresAtText: string,
  swapValidityText: string,
): string {
  return [
    '🔁 <b>Своп подготовлен к выбору маршрута</b>',
    '',
    `🔁 ${formatPair(quotes.fromAmount, quotes.fromSymbol, quotes.toAmount, quotes.toSymbol)}`,
    `🌐 Сеть: <code>${escapeHtml(quotes.chain)}</code>`,
    `🏆 Лучший агрегатор: <code>${escapeHtml(quotes.aggregator)}</code>`,
    '',
    `💸 Gross: ${formatAmount(quotes.grossToAmount, quotes.toSymbol)}`,
    `🤖 Комиссия бота: ${formatFee(quotes.feeAmount, quotes.feeAmountSymbol ?? quotes.toSymbol, quotes.feeBps, quotes.feeDisplayLabel)}`,
    `✅ Net: ${formatAmount(quotes.toAmount, quotes.toSymbol)}`,
    `⏳ Срок актуальности: ${escapeHtml(swapValidityText)}`,
    `🕒 Котировка актуальна до: <code>${escapeHtml(quoteExpiresAtText)}</code>`,
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

export function buildPreparedSwapMessage(input: {
  session: ISwapSessionResponse;
  expiresAtText: string;
  quoteExpiresAtText: string;
  swapValidityText: string;
  deliveryHint: string;
}): string {
  const { deliveryHint, expiresAtText, quoteExpiresAtText, session, swapValidityText } = input;

  return [
    '👛 <b>Своп подготовлен</b>',
    '',
    `🔁 ${formatPair(session.fromAmount, session.fromSymbol, session.toAmount, session.toSymbol)}`,
    `🌐 Сеть: <code>${escapeHtml(session.chain)}</code>`,
    `🏆 Агрегатор: <code>${escapeHtml(session.aggregator)}</code>`,
    '',
    `💸 Gross: ${formatAmount(session.grossToAmount, session.toSymbol)}`,
    `🤖 Комиссия бота: ${formatAmount(session.feeAmount, session.feeAmountSymbol ?? session.toSymbol)}`,
    `✅ Net: ${formatAmount(session.toAmount, session.toSymbol)}`,
    '',
    `🆔 Session ID: <code>${escapeHtml(session.sessionId)}</code>`,
    `⏳ Сессия истекает: <code>${escapeHtml(expiresAtText)}</code>`,
    `🕒 Котировка актуальна до: <code>${escapeHtml(quoteExpiresAtText)}</code>`,
    `ℹ️ Срок актуальности свопа: ${escapeHtml(swapValidityText)}`,
    '',
    'ℹ️ Транзакция уже собрана с учётом комиссии бота.',
    `ℹ️ ${escapeHtml(deliveryHint)}`,
  ].join('\n');
}

export function buildConnectionStatusMessage(status: IWalletConnectionStatus): string {
  return [
    '👛 <b>Подключения кошельков</b>',
    '',
    `EVM: ${formatConnectionAddress(status.evm?.address)}`,
    `Solana: ${formatConnectionAddress(status.solana?.address)}`,
    '',
    'ℹ️ EVM-подключение общее для <code>ethereum</code>, <code>arbitrum</code>, <code>base</code> и <code>optimism</code>.',
  ].join('\n');
}

export function buildConnectionSessionMessage(
  chain: ChainType,
  sessionId: string,
  expiresAtText: string,
): string {
  return [
    chain === 'solana' ? '👛 <b>Подключение Phantom</b>' : '👛 <b>Подключение кошелька</b>',
    '',
    `🌐 Сеть: <code>${escapeHtml(chain)}</code>`,
    `🆔 Session ID: <code>${escapeHtml(sessionId)}</code>`,
    `⏳ Сессия истекает: <code>${escapeHtml(expiresAtText)}</code>`,
    '',
    `ℹ️ ${
      chain === 'solana'
        ? 'Открой Phantom по кнопке или отсканируй QR.'
        : 'Отсканируй QR в MetaMask или Trust Wallet.'
    }`,
  ].join('\n');
}

export function buildQrCaption(
  kind: 'connect' | 'swap',
  chain: ChainType,
  sessionId: string,
  expiresAtText: string,
): string {
  const mainText =
    kind === 'connect'
      ? chain === 'solana'
        ? 'ℹ️ Отсканируй QR в Phantom для подключения.'
        : 'ℹ️ Отсканируй QR в MetaMask или Trust Wallet для подключения.'
      : chain === 'solana'
        ? 'ℹ️ Отсканируй QR в Phantom для подписи.'
        : 'ℹ️ Отсканируй QR в EVM-кошельке для подтверждения.';

  return [
    mainText,
    `🆔 Session ID: <code>${escapeHtml(sessionId)}</code>`,
    `⏳ Сессия истекает: <code>${escapeHtml(expiresAtText)}</code>`,
  ].join('\n');
}

export function buildDisconnectMessage(chain: ChainType | null): string {
  return chain
    ? `✅ Подключение для ${escapeHtml(chain === 'solana' ? 'Solana' : 'EVM')} отключено.`
    : '✅ Все локальные подключения отключены.';
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
  return '🔔 Введи целевое количество to-токена, при котором нужно прислать уведомление.';
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

export function buildSettingsMenuMessage(slippage: string, aggregatorLabel: string): string {
  return [
    '⚙️ <b>Настройки свопа</b>',
    '',
    `📏 Slippage: <b>${escapeHtml(slippage)}%</b>`,
    `🏆 Агрегатор: <b>${escapeHtml(aggregatorLabel)}</b>`,
  ].join('\n');
}

export function buildSlippageMenuMessage(): string {
  return '⚙️ <b>Выбери slippage</b>';
}

export function buildAggregatorMenuMessage(): string {
  return '⚙️ <b>Выбери агрегатор</b>';
}

export function buildCustomSlippagePrompt(min: number, max: number): string {
  return `ℹ️ Введи slippage в процентах от <b>${min}%</b> до <b>${max}%</b>.`;
}

export function buildErrorMessage(message: string): string {
  return `❌ <b>Ошибка:</b> ${escapeHtml(message)}`;
}

export function buildInfoMessage(message: string): string {
  return `ℹ️ ${escapeHtml(message)}`;
}

function buildProviderQuoteLine(quote: IProviderQuote, toSymbol: string): string {
  return `• <code>${escapeHtml(quote.aggregator)}</code>: gross ${escapeHtml(quote.grossToAmount)} ${escapeHtml(toSymbol)}, fee ${escapeHtml(quote.feeAmount)} ${escapeHtml(quote.feeAmountSymbol ?? toSymbol)}, net ${escapeHtml(quote.toAmount)} ${escapeHtml(toSymbol)}, gas ${escapeHtml(formatGas(quote.estimatedGasUsd))}`;
}

function buildSwapRouteLine(
  quote: IProviderQuote,
  toSymbol: string,
  bestAggregator: string,
): string {
  const prefix = quote.aggregator === bestAggregator ? '⭐ ' : '';
  return `• ${prefix}<code>${escapeHtml(quote.aggregator)}</code>: net ${escapeHtml(quote.toAmount)} ${escapeHtml(toSymbol)}`;
}

function formatAmount(amount: string, symbol: string): string {
  return `${escapeHtml(amount)} ${escapeHtml(symbol)}`;
}

function formatFee(amount: string, symbol: string, feeBps: number, label: string): string {
  return `${formatAmount(amount, symbol)} (${feeBps} bps, ${escapeHtml(label)})`;
}

function formatPair(
  fromAmount: string,
  fromSymbol: string,
  toAmount: string,
  toSymbol: string,
): string {
  return `${escapeHtml(fromAmount)} ${escapeHtml(fromSymbol)} → ${escapeHtml(toAmount)} ${escapeHtml(toSymbol)}`;
}

function formatGas(value: number | null): string {
  return value === null ? 'N/A' : `$${value.toFixed(GAS_USD_PRECISION)}`;
}

function formatConnectionAddress(address: string | undefined): string {
  if (!address || address.trim() === '') {
    return 'не подключён';
  }

  return `<code>${escapeHtml(shortenHash(address))}</code>`;
}

function formatTxHash(txHash: string | null): string {
  if (!txHash) {
    return 'неизвестно';
  }

  return `<code>${escapeHtml(shortenHash(txHash))}</code>`;
}

function shortenHash(value: string): string {
  if (value.length <= SHORT_HASH_PREFIX + SHORT_HASH_SUFFIX) {
    return value;
  }

  return `${value.slice(0, SHORT_HASH_PREFIX)}...${value.slice(-SHORT_HASH_SUFFIX)}`;
}
