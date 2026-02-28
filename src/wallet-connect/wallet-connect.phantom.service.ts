import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bs58 from 'bs58';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import nacl from 'tweetnacl';

import { AGGREGATORS_TOKEN } from '../aggregators/aggregators.constants';
import type { IAggregator, ISwapTransaction } from '../aggregators/interfaces/aggregator.interface';
import { SolanaChain } from '../chains/solana/solana.chain';
import { BusinessException } from '../common/exceptions/business.exception';
import { MetricsService } from '../metrics/metrics.service';
import type {
  ICreateWalletConnectSessionInput,
  IPhantomCallbackQuery,
  IPhantomSessionState,
  IWalletConnectSession,
  IWalletConnectSessionPublic,
} from './interfaces/wallet-connect.interface';
import {
  DEFAULT_APP_PUBLIC_URL,
  DEFAULT_SWAP_SLIPPAGE,
  DEFAULT_SWAP_TIMEOUT_SECONDS,
  MIN_SWAP_TIMEOUT_SECONDS,
  PHANTOM_APP_BASE_URL,
  PHANTOM_CLUSTER,
  PHANTOM_CONNECT_CALLBACK_PATH,
  PHANTOM_CONNECT_METHOD,
  PHANTOM_NONCE_LENGTH,
  PHANTOM_SIGN_CALLBACK_PATH,
  PHANTOM_SIGN_TRANSACTION_METHOD,
  TELEGRAM_API_BASE_URL,
  TELEGRAM_PREVIEW_DISABLED,
} from './wallet-connect.constants';
import type {
  IPhantomConnectPayload,
  IPhantomSignedTransactionPayload,
} from './wallet-connect.phantom.types';
import { WalletConnectSessionStore } from './wallet-connect.session-store';
import { escapeHtml, getWalletConnectErrorMessage } from './wallet-connect.utils';

@Injectable()
export class WalletConnectPhantomService {
  private readonly logger = new Logger(WalletConnectPhantomService.name);
  private readonly appPublicUrl: string;
  private readonly swapTimeoutSeconds: number;
  private readonly swapSlippage: number;
  private readonly telegramBotToken: string;

  @Inject(AGGREGATORS_TOKEN)
  private readonly aggregators!: readonly IAggregator[];

  public constructor(
    private readonly configService: ConfigService,
    private readonly sessionStore: WalletConnectSessionStore,
    private readonly metricsService: MetricsService,
    private readonly solanaChain: SolanaChain,
  ) {
    this.appPublicUrl = this.configService.get<string>('APP_PUBLIC_URL') ?? DEFAULT_APP_PUBLIC_URL;
    this.swapTimeoutSeconds = this.resolveTimeoutSeconds();
    this.swapSlippage = this.resolveSwapSlippage();
    this.telegramBotToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
  }

  public async createSession(
    input: ICreateWalletConnectSessionInput,
  ): Promise<IWalletConnectSessionPublic> {
    const sessionId = randomUUID();
    const expiresAt = Date.now() + this.swapTimeoutSeconds * 1_000;
    const keyPair = nacl.box.keyPair();
    const phantomState: IPhantomSessionState = {
      dappEncryptionPublicKey: bs58.encode(keyPair.publicKey),
      dappEncryptionSecretKey: bs58.encode(keyPair.secretKey),
    };
    const uri = this.buildPhantomUrl(PHANTOM_CONNECT_METHOD, {
      dapp_encryption_public_key: phantomState.dappEncryptionPublicKey,
      cluster: PHANTOM_CLUSTER,
      app_url: this.appPublicUrl,
      redirect_link: this.buildAppUrl(PHANTOM_CONNECT_CALLBACK_PATH, sessionId),
    });
    const session: IWalletConnectSession = {
      sessionId,
      userId: input.userId,
      uri,
      expiresAt,
      swapPayload: {
        ...input.swapPayload,
        slippagePercentage: this.swapSlippage,
      },
      phantom: phantomState,
    };

    this.sessionStore.save(session);
    this.metricsService.incrementSwapRequest('initiated');

    return {
      sessionId,
      uri: session.uri,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  public getPhantomConnectUrl(sessionId: string): string {
    return this.getSolanaSession(sessionId).uri;
  }

  public async handleConnectCallback(query: IPhantomCallbackQuery): Promise<string> {
    const session = this.getSolanaSession(query.sessionId);
    const phantomState = this.ensurePhantomState(session);

    try {
      this.throwIfPhantomRejected(query, 'Подключение Phantom было отклонено');
      const phantomEncryptionPublicKey = this.getRequiredQueryValue(
        query.phantom_encryption_public_key,
        'phantom_encryption_public_key',
      );
      const sharedSecret = nacl.box.before(
        this.decodeBase58(phantomEncryptionPublicKey, 'phantom_encryption_public_key'),
        this.decodeBase58(phantomState.dappEncryptionSecretKey, 'dapp_encryption_secret_key'),
      );
      const connectPayload = this.toPhantomConnectPayload(
        this.decryptPhantomPayload(
          this.getRequiredQueryValue(query.data, 'data'),
          this.getRequiredQueryValue(query.nonce, 'nonce'),
          sharedSecret,
        ),
      );

      session.phantom = {
        ...phantomState,
        sharedSecret: bs58.encode(sharedSecret),
        phantomEncryptionPublicKey,
        phantomSession: this.getRequiredPayloadValue(connectPayload.session, 'session'),
        walletAddress: this.getRequiredPayloadValue(connectPayload.public_key, 'public_key'),
      };
      const connectedState = this.getConnectedPhantomState(session);
      const transaction = await this.buildSwapTransaction(
        session.sessionId,
        this.getRequiredPayloadValue(connectedState.walletAddress, 'walletAddress'),
      );

      return this.buildPhantomSignTransactionUrl(session, transaction);
    } catch (error: unknown) {
      const message = getWalletConnectErrorMessage(error);
      this.metricsService.incrementSwapRequest('error');
      await this.sendTelegramMessage(
        session.userId,
        `Ошибка подключения Phantom: ${escapeHtml(message)}`,
      );
      throw new BusinessException(message);
    }
  }

  public async handleSignCallback(
    query: IPhantomCallbackQuery,
  ): Promise<{ explorerUrl: string; transactionHash: string }> {
    const session = this.getSolanaSession(query.sessionId);

    try {
      this.throwIfPhantomRejected(query, 'Подпись в Phantom была отклонена');
      const phantomState = this.getConnectedPhantomState(session);
      const signedPayload = this.toPhantomSignedTransactionPayload(
        this.decryptPhantomPayload(
          this.getRequiredQueryValue(query.data, 'data'),
          this.getRequiredQueryValue(query.nonce, 'nonce'),
          this.decodeBase58(
            this.getRequiredPayloadValue(phantomState.sharedSecret, 'sharedSecret'),
            'sharedSecret',
          ),
        ),
      );
      const transactionHash = await this.solanaChain.broadcastSignedTransaction(
        Uint8Array.from(
          this.decodeBase58(
            this.getRequiredPayloadValue(signedPayload.transaction, 'transaction'),
            'transaction',
          ),
        ),
        this.getRequiredLastValidBlockHeight(session),
      );
      const explorerUrl = this.buildExplorerUrl(transactionHash);

      await this.sendTelegramMessage(
        session.userId,
        [
          'Своп отправлен.',
          'Сеть: solana',
          `Агрегатор: ${session.swapPayload.aggregatorName}`,
          `Tx: <code>${escapeHtml(transactionHash)}</code>`,
          `<a href="${explorerUrl}">Открыть в эксплорере</a>`,
        ].join('\n'),
      );
      this.metricsService.incrementSwapRequest('success');

      return {
        explorerUrl,
        transactionHash,
      };
    } catch (error: unknown) {
      const message = getWalletConnectErrorMessage(error);
      this.metricsService.incrementSwapRequest('error');
      await this.sendTelegramMessage(session.userId, `Ошибка свопа: ${escapeHtml(message)}`);
      throw new BusinessException(message);
    } finally {
      this.sessionStore.delete(query.sessionId);
    }
  }

  public async buildSwapTransaction(
    sessionId: string,
    walletAddress: string,
  ): Promise<ISwapTransaction> {
    const session = this.getSolanaSession(sessionId);
    const aggregator = this.resolveAggregator(session.swapPayload.aggregatorName);

    return aggregator.buildSwapTransaction({
      chain: session.swapPayload.chain,
      sellTokenAddress: session.swapPayload.sellTokenAddress,
      buyTokenAddress: session.swapPayload.buyTokenAddress,
      sellAmountBaseUnits: session.swapPayload.sellAmountBaseUnits,
      sellTokenDecimals: session.swapPayload.sellTokenDecimals,
      buyTokenDecimals: session.swapPayload.buyTokenDecimals,
      fromAddress: walletAddress,
      slippagePercentage: session.swapPayload.slippagePercentage,
    });
  }

  private resolveTimeoutSeconds(): number {
    const rawTimeout = this.configService.get<string>('SWAP_TIMEOUT_SECONDS');
    const parsedTimeout = Number.parseInt(rawTimeout ?? `${DEFAULT_SWAP_TIMEOUT_SECONDS}`, 10);

    if (!Number.isInteger(parsedTimeout) || parsedTimeout < MIN_SWAP_TIMEOUT_SECONDS) {
      return DEFAULT_SWAP_TIMEOUT_SECONDS;
    }

    return parsedTimeout;
  }

  private resolveSwapSlippage(): number {
    const rawSlippage = this.configService.get<string>('SWAP_SLIPPAGE');
    const parsedSlippage = Number.parseFloat(rawSlippage ?? `${DEFAULT_SWAP_SLIPPAGE}`);

    if (!Number.isFinite(parsedSlippage) || parsedSlippage <= 0) {
      return DEFAULT_SWAP_SLIPPAGE;
    }

    return parsedSlippage;
  }

  private getSolanaSession(sessionId: string): IWalletConnectSession {
    const session = this.sessionStore.get(sessionId);

    if (session?.swapPayload.chain !== 'solana') {
      throw new BusinessException('Solana swap session is not found or expired');
    }

    return session;
  }

  private ensurePhantomState(session: IWalletConnectSession): IPhantomSessionState {
    if (!session.phantom) {
      throw new BusinessException('Phantom session state is not initialized');
    }

    return session.phantom;
  }

  private getConnectedPhantomState(session: IWalletConnectSession): IPhantomSessionState {
    const phantomState = session.phantom;

    if (
      !phantomState?.sharedSecret ||
      !phantomState.phantomSession ||
      !phantomState.walletAddress
    ) {
      throw new BusinessException('Phantom session is not connected');
    }

    return phantomState;
  }

  private resolveAggregator(aggregatorName: string): IAggregator {
    const aggregator = this.aggregators.find(
      (candidateAggregator) => candidateAggregator.name === aggregatorName,
    );

    if (!aggregator) {
      throw new BusinessException(`Aggregator ${aggregatorName} is not available for swap`);
    }

    return aggregator;
  }

  private throwIfPhantomRejected(query: IPhantomCallbackQuery, fallbackMessage: string): void {
    if (!query.errorCode && !query.errorMessage) {
      return;
    }

    const details = [query.errorCode, query.errorMessage].filter(Boolean).join(': ');
    throw new BusinessException(
      details === '' ? fallbackMessage : `${fallbackMessage}: ${details}`,
    );
  }

  private getRequiredQueryValue(value: string | undefined, key: string): string {
    if (!value || value.trim() === '') {
      throw new BusinessException(`Phantom callback is missing query parameter "${key}"`);
    }

    return value;
  }

  private getRequiredPayloadValue(value: string | undefined, key: string): string {
    if (!value || value.trim() === '') {
      throw new BusinessException(`Phantom payload field "${key}" is missing`);
    }

    return value;
  }

  private toPhantomConnectPayload(payload: Record<string, string>): IPhantomConnectPayload {
    return {
      public_key: this.getRequiredPayloadValue(payload['public_key'], 'public_key'),
      session: this.getRequiredPayloadValue(payload['session'], 'session'),
    };
  }

  private toPhantomSignedTransactionPayload(
    payload: Record<string, string>,
  ): IPhantomSignedTransactionPayload {
    return {
      transaction: this.getRequiredPayloadValue(payload['transaction'], 'transaction'),
    };
  }

  private decryptPhantomPayload(
    data: string,
    nonce: string,
    sharedSecret: Uint8Array,
  ): Record<string, string> {
    const decryptedData = nacl.box.open.after(
      this.decodeBase58(data, 'data'),
      this.decodeBase58(nonce, 'nonce'),
      sharedSecret,
    );

    if (!decryptedData) {
      throw new BusinessException('Failed to decrypt Phantom payload');
    }

    return JSON.parse(Buffer.from(decryptedData).toString('utf8')) as Record<string, string>;
  }

  private encryptPhantomPayload(
    payload: object,
    sharedSecret: Uint8Array,
  ): { nonce: string; payload: string } {
    const nonce = nacl.randomBytes(PHANTOM_NONCE_LENGTH);
    const encryptedPayload = nacl.box.after(
      Buffer.from(JSON.stringify(payload)),
      nonce,
      sharedSecret,
    );

    return {
      nonce: bs58.encode(nonce),
      payload: bs58.encode(encryptedPayload),
    };
  }

  private decodeBase58(value: string, label: string): Uint8Array {
    try {
      return bs58.decode(value);
    } catch {
      throw new BusinessException(`Phantom field "${label}" is not valid base58`);
    }
  }

  private buildPhantomSignTransactionUrl(
    session: IWalletConnectSession,
    transaction: ISwapTransaction,
  ): string {
    if (
      transaction.kind !== 'solana' ||
      !transaction.serializedTransaction ||
      !transaction.lastValidBlockHeight
    ) {
      throw new BusinessException('Solana swap transaction is missing');
    }

    const phantomState = this.getConnectedPhantomState(session);
    const sharedSecret = this.decodeBase58(
      this.getRequiredPayloadValue(phantomState.sharedSecret, 'sharedSecret'),
      'sharedSecret',
    );
    const encryptedPayload = this.encryptPhantomPayload(
      {
        session: this.getRequiredPayloadValue(phantomState.phantomSession, 'phantomSession'),
        transaction: bs58.encode(Buffer.from(transaction.serializedTransaction, 'base64')),
      },
      sharedSecret,
    );
    session.swapPayload = {
      ...session.swapPayload,
      slippagePercentage: session.swapPayload.slippagePercentage,
    };
    session.phantom = {
      ...phantomState,
      walletAddress: this.getRequiredPayloadValue(phantomState.walletAddress, 'walletAddress'),
      lastValidBlockHeight: transaction.lastValidBlockHeight,
    };

    return this.buildPhantomUrl(PHANTOM_SIGN_TRANSACTION_METHOD, {
      dapp_encryption_public_key: phantomState.dappEncryptionPublicKey,
      nonce: encryptedPayload.nonce,
      redirect_link: this.buildAppUrl(PHANTOM_SIGN_CALLBACK_PATH, session.sessionId),
      payload: encryptedPayload.payload,
    });
  }

  private getRequiredLastValidBlockHeight(session: IWalletConnectSession): number {
    const rawValue = session.phantom?.lastValidBlockHeight;

    if (rawValue === undefined) {
      throw new BusinessException('Solana lastValidBlockHeight is missing');
    }

    if (!Number.isInteger(rawValue) || rawValue <= 0) {
      throw new BusinessException('Solana lastValidBlockHeight is invalid');
    }

    return rawValue;
  }

  private buildAppUrl(pathname: string, sessionId: string): string {
    const url = new URL(pathname, this.appPublicUrl);
    url.searchParams.set('sessionId', sessionId);
    return url.toString();
  }

  private buildPhantomUrl(method: string, params: Record<string, string>): string {
    const url = new URL(method, PHANTOM_APP_BASE_URL);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    return url.toString();
  }

  private buildExplorerUrl(transactionHash: string): string {
    const baseUrl =
      this.configService.get<string>('EXPLORER_URL_SOLANA') ?? 'https://solscan.io/tx/';

    if (baseUrl.trim() === '') {
      throw new BusinessException('Explorer URL for chain solana is not configured');
    }

    return `${baseUrl}${transactionHash}`;
  }

  private async sendTelegramMessage(chatId: string, text: string): Promise<void> {
    if (this.telegramBotToken.trim() === '') {
      return;
    }

    const response = await fetch(
      `${TELEGRAM_API_BASE_URL}/bot${this.telegramBotToken}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: TELEGRAM_PREVIEW_DISABLED,
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      this.logger.warn(`Telegram sendMessage failed: ${response.status} ${body}`);
    }
  }
}
