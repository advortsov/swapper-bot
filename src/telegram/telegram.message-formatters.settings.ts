import { escapeHtml } from '../wallet-connect/wallet-connect.utils';

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
