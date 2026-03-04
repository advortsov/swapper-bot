import type { ChainType } from '../chains/interfaces/chain.interface';
import type { IProviderQuote } from '../price/interfaces/price.interface';
import { escapeHtml } from '../wallet-connect/wallet-connect.utils';

const GAS_USD_PRECISION = 4;
const SHORT_HASH_PREFIX = 6;
const SHORT_HASH_SUFFIX = 4;

export function buildErrorMessage(message: string): string {
  return `❌ <b>Ошибка:</b> ${escapeHtml(message)}`;
}

export function buildInfoMessage(message: string): string {
  return `ℹ️ ${escapeHtml(message)}`;
}

export function buildProviderQuoteLine(quote: IProviderQuote, toSymbol: string): string {
  return `• <code>${escapeHtml(quote.aggregator)}</code>: gross ${escapeHtml(quote.grossToAmount)} ${escapeHtml(toSymbol)}, fee ${escapeHtml(quote.feeAmount)} ${escapeHtml(quote.feeAmountSymbol ?? toSymbol)}, net ${escapeHtml(quote.toAmount)} ${escapeHtml(toSymbol)}, gas ${escapeHtml(formatGas(quote.estimatedGasUsd))}`;
}

export function buildSwapRouteLine(
  quote: IProviderQuote,
  toSymbol: string,
  bestAggregator: string,
): string {
  const prefix = quote.aggregator === bestAggregator ? '⭐ ' : '';
  return `• ${prefix}<code>${escapeHtml(quote.aggregator)}</code>: net ${escapeHtml(quote.toAmount)} ${escapeHtml(toSymbol)}`;
}

export function formatAmount(amount: string, symbol: string): string {
  return `${escapeHtml(amount)} ${escapeHtml(symbol)}`;
}

export function formatFee(amount: string, symbol: string, feeBps: number, label: string): string {
  return `${formatAmount(amount, symbol)} (${feeBps} bps, ${escapeHtml(label)})`;
}

export function formatPair(
  fromAmount: string,
  fromSymbol: string,
  toAmount: string,
  toSymbol: string,
): string {
  return `${escapeHtml(fromAmount)} ${escapeHtml(fromSymbol)} → ${escapeHtml(toAmount)} ${escapeHtml(toSymbol)}`;
}

export function formatGas(value: number | null): string {
  return value === null ? 'N/A' : `$${value.toFixed(GAS_USD_PRECISION)}`;
}

export function formatConnectionAddress(address: string | undefined): string {
  if (!address || address.trim() === '') {
    return 'не подключён';
  }

  return `<code>${escapeHtml(shortenHash(address))}</code>`;
}

export function formatTxHash(txHash: string | null): string {
  if (!txHash) {
    return 'неизвестно';
  }

  return `<code>${escapeHtml(shortenHash(txHash))}</code>`;
}

export function formatChainCode(chain: ChainType): string {
  return `<code>${escapeHtml(chain)}</code>`;
}

function shortenHash(value: string): string {
  if (value.length <= SHORT_HASH_PREFIX + SHORT_HASH_SUFFIX) {
    return value;
  }

  return `${value.slice(0, SHORT_HASH_PREFIX)}...${value.slice(-SHORT_HASH_SUFFIX)}`;
}
