import type { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type SignClient from '@walletconnect/sign-client';
import type { SessionTypes } from '@walletconnect/types';

import type {
  IWalletConnectionSession,
  IWalletConnectSession,
  IWalletConnectSwapPayload,
  WalletConnectionFamily,
} from './interfaces/wallet-connect.interface';
import {
  CHAIN_CONFIG_BY_CHAIN,
  TELEGRAM_API_BASE_URL,
  TELEGRAM_PREVIEW_DISABLED,
  WALLETCONNECT_ICON_URL,
  type IWalletConnectChainConfig,
} from './wallet-connect.constants';
import { escapeHtml, getWalletConnectErrorMessage } from './wallet-connect.utils';
import type { IAggregator, ISwapTransaction } from '../aggregators/interfaces/aggregator.interface';
import type { ChainType } from '../chains/interfaces/chain.interface';
import { BusinessException } from '../common/exceptions/business.exception';

export function createWalletConnectMetadata(appPublicUrl: string): {
  name: string;
  description: string;
  url: string;
  icons: string[];
  redirect: { universal: string };
} {
  return {
    name: 'swapper-bot',
    description: 'DEX Aggregator Telegram Bot',
    url: appPublicUrl,
    icons: [WALLETCONNECT_ICON_URL],
    redirect: {
      universal: appPublicUrl,
    },
  };
}

export async function waitForWalletConnectApproval(
  approvalCallback: () => Promise<SessionTypes.Struct>,
  expiresAt: number,
): Promise<SessionTypes.Struct> {
  const timeout = Math.max(expiresAt - Date.now(), 1);
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    setTimeout(() => {
      reject(new BusinessException('WalletConnect approval timed out'));
    }, timeout);
  });

  return Promise.race([approvalCallback(), timeoutPromise]);
}

export function registerWalletConnectClientEvents(signClient: SignClient, logger: Logger): void {
  if (signClient.events.listenerCount('session_connect') === 0) {
    signClient.on('session_connect', ({ session }) => {
      logger.log(`WalletConnect session connected: ${session.topic}`);
    });
  }

  if (signClient.events.listenerCount('session_expire') === 0) {
    signClient.on('session_expire', ({ topic }) => {
      logger.warn(`WalletConnect session expired: ${topic}`);
    });
  }

  if (signClient.events.listenerCount('session_delete') === 0) {
    signClient.on('session_delete', ({ topic }) => {
      logger.warn(`WalletConnect session deleted: ${topic}`);
    });
  }
}

export function getWalletConnectChainConfig(chain: ChainType): IWalletConnectChainConfig {
  return CHAIN_CONFIG_BY_CHAIN[chain];
}

export function getWalletConnectionFamily(chain: ChainType): WalletConnectionFamily {
  return chain === 'solana' ? 'solana' : 'evm';
}

const EVM_HEX_RADIX = 16;

export function getWalletConnectSwapPayload(
  session: IWalletConnectSession,
): IWalletConnectSwapPayload {
  if (!session.swapPayload) {
    throw new BusinessException('Swap payload is not available for this WalletConnect session');
  }

  return session.swapPayload;
}

export function extractWalletAddress(session: SessionTypes.Struct, chain: ChainType): string {
  const chainConfig = getWalletConnectChainConfig(chain);
  const accounts = session.namespaces[chainConfig.namespace]?.accounts ?? [];
  const account = accounts[0];

  if (!account) {
    throw new BusinessException(`WalletConnect session for ${chain} does not contain accounts`);
  }

  const walletAddress = account.split(':').at(-1);

  if (!walletAddress) {
    throw new BusinessException(`WalletConnect account format is invalid for ${chain}`);
  }

  return walletAddress;
}

export function buildSwapTransactionForPayload(
  swapPayload: IWalletConnectSwapPayload,
  aggregator: IAggregator,
  walletAddress: string,
): Promise<ISwapTransaction> {
  return aggregator.buildSwapTransaction({
    chain: swapPayload.chain,
    sellTokenAddress: swapPayload.sellTokenAddress,
    buyTokenAddress: swapPayload.buyTokenAddress,
    sellAmountBaseUnits: swapPayload.sellAmountBaseUnits,
    sellTokenDecimals: swapPayload.sellTokenDecimals,
    buyTokenDecimals: swapPayload.buyTokenDecimals,
    fromAddress: walletAddress,
    slippagePercentage: swapPayload.slippagePercentage,
    feeConfig: swapPayload.executionFee,
  });
}

export function parseWalletConnectTransactionResult(result: unknown): string {
  if (typeof result === 'string' && result.trim() !== '') {
    return result;
  }

  if (typeof result === 'object' && result !== null) {
    const candidate = result as Record<string, unknown>;

    if (typeof candidate['signature'] === 'string' && candidate['signature'].trim() !== '') {
      return candidate['signature'];
    }

    if (typeof candidate['txHash'] === 'string' && candidate['txHash'].trim() !== '') {
      return candidate['txHash'];
    }
  }

  throw new BusinessException('WalletConnect transaction result is invalid');
}

export function buildWalletExplorerUrl(
  _configService: ConfigService,
  chain: ChainType,
  transactionHash: string,
): string {
  const getExplorerUrl = (key: string): string | undefined => {
    const value = process.env[key];
    return typeof value === 'string' ? value : undefined;
  };

  const explorerUrlByChain: Readonly<Record<ChainType, string>> = {
    ethereum: getExplorerUrl('EXPLORER_URL_ETHEREUM') ?? 'https://etherscan.io/tx/',
    arbitrum: getExplorerUrl('EXPLORER_URL_ARBITRUM') ?? 'https://arbiscan.io/tx/',
    base: getExplorerUrl('EXPLORER_URL_BASE') ?? 'https://basescan.org/tx/',
    optimism: getExplorerUrl('EXPLORER_URL_OPTIMISM') ?? 'https://optimistic.etherscan.io/tx/',
    solana: getExplorerUrl('EXPLORER_URL_SOLANA') ?? 'https://solscan.io/tx/',
  };

  const baseUrl = explorerUrlByChain[chain];

  if (baseUrl.trim() === '') {
    throw new BusinessException(`Explorer URL for chain ${chain} is not configured`);
  }

  return `${baseUrl}${transactionHash}`;
}

export async function requestWalletConnectExecution(input: {
  signClient: SignClient;
  topic: string;
  chain: ChainType;
  walletAddress: string;
  transaction: ISwapTransaction;
}): Promise<string> {
  const { chain, signClient, topic, transaction, walletAddress } = input;
  const chainConfig = getWalletConnectChainConfig(chain);

  if (topic.trim() === '') {
    throw new BusinessException('WalletConnect topic is missing');
  }

  if (transaction.kind === 'solana') {
    const serializedTransaction = transaction.serializedTransaction;

    if (!serializedTransaction) {
      throw new BusinessException('Solana transaction payload is missing');
    }

    const result = await signClient.request({
      topic,
      chainId: chainConfig.chainId,
      request: {
        method: 'solana_signAndSendTransaction',
        params: {
          transaction: serializedTransaction,
        },
      },
    });

    return parseWalletConnectTransactionResult(result);
  }

  const result = await signClient.request({
    topic,
    chainId: chainConfig.chainId,
    request: {
      method: 'eth_sendTransaction',
      params: [
        {
          from: walletAddress,
          to: transaction.to,
          data: transaction.data,
          value: normalizeEvmQuantity(transaction.value),
        },
      ],
    },
  });

  return parseWalletConnectTransactionResult(result);
}

export function normalizeEvmQuantity(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (normalized.startsWith('0x')) {
    return normalized;
  }

  try {
    return `0x${BigInt(normalized).toString(EVM_HEX_RADIX)}`;
  } catch {
    throw new BusinessException(`Invalid EVM quantity: ${value}`);
  }
}

export function saveWalletConnection(input: {
  session: IWalletConnectSession;
  approvedSession: SessionTypes.Struct;
  walletAddress: string;
}): IWalletConnectionSession {
  const { approvedSession, session, walletAddress } = input;
  const now = Date.now();
  const approvedExpiry =
    approvedSession.expiry > 0 ? approvedSession.expiry * 1000 : session.expiresAt;

  return {
    userId: session.userId,
    family: session.family,
    chain: session.chain,
    address: walletAddress,
    topic: approvedSession.topic,
    walletLabel: approvedSession.peer.metadata.name,
    connectedAt: now,
    lastUsedAt: now,
    expiresAt: approvedExpiry,
  };
}

export function resolveWalletConnectAggregator(
  aggregators: readonly IAggregator[],
  aggregatorName: string,
): IAggregator {
  const aggregator = aggregators.find(
    (candidateAggregator) => candidateAggregator.name === aggregatorName,
  );

  if (!aggregator) {
    throw new BusinessException(`Aggregator ${aggregatorName} is not available for swap`);
  }

  return aggregator;
}

export async function sendWalletConnectTelegramMessage(input: {
  telegramBotToken: string;
  chatId: string;
  text: string;
  replyMarkup?: Record<string, unknown>;
  logger: Logger;
}): Promise<void> {
  if (input.telegramBotToken.trim() === '') {
    return;
  }

  const response = await fetch(
    `${TELEGRAM_API_BASE_URL}/bot${input.telegramBotToken}/sendMessage`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: input.chatId,
        text: input.text,
        parse_mode: 'HTML',
        disable_web_page_preview: TELEGRAM_PREVIEW_DISABLED,
        reply_markup: input.replyMarkup,
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    input.logger.warn(`Telegram sendMessage failed: ${response.status} ${body}`);
  }
}

export function escapeWalletConnectHtml(value: string): string {
  return escapeHtml(value);
}

export function getWalletConnectErrorWithLog(error: unknown, logger: Logger): string {
  const errorObj =
    typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : null;

  if (errorObj) {
    logger.error(`Full error object: ${JSON.stringify(errorObj)}`);
  }

  return getWalletConnectErrorMessage(error);
}
