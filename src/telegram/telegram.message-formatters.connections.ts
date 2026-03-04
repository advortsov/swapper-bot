import { formatChainCode, formatConnectionAddress } from './telegram.message-formatters.shared';
import type { ChainType } from '../chains/interfaces/chain.interface';
import type { IWalletConnectionStatus } from '../wallet-connect/interfaces/wallet-connect.interface';
import { escapeHtml } from '../wallet-connect/wallet-connect.utils';

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
    `🌐 Сеть: ${formatChainCode(chain)}`,
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

export function buildDisconnectMessage(chain: ChainType | null): string {
  return chain
    ? `✅ Подключение для ${escapeHtml(chain === 'solana' ? 'Solana' : 'EVM')} отключено.`
    : '✅ Все локальные подключения отключены.';
}
