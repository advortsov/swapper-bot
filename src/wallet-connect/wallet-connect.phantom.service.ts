import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import nacl from 'tweetnacl';

import { AGGREGATORS_TOKEN } from '../aggregators/aggregators.constants';
import type {
  ICreateWalletConnectConnectionInput,
  ICreateWalletConnectSessionInput,
  IPhantomCallbackQuery,
  IPhantomSessionState,
  IWalletConnectionSession,
  IWalletConnectSession,
  IWalletConnectSwapPayload,
  IWalletConnectSessionPublic,
} from './interfaces/wallet-connect.interface';
import {
  DEFAULT_APP_PUBLIC_URL,
  DEFAULT_SWAP_TIMEOUT_SECONDS,
  MIN_SWAP_TIMEOUT_SECONDS,
  PHANTOM_CLUSTER,
  PHANTOM_CONNECT_CALLBACK_PATH,
  PHANTOM_CONNECT_METHOD,
  TELEGRAM_API_BASE_URL,
  TELEGRAM_PREVIEW_DISABLED,
} from './wallet-connect.constants';
import {
  buildAppUrl,
  buildPhantomSignTransactionUrl,
  buildPhantomUrl,
  buildSolanaExplorerUrl,
  decodeBase58,
  encodeBase58,
  decryptPhantomPayload,
  getRequiredLastValidBlockHeight,
  getRequiredPayloadValue,
  getRequiredQueryValue,
  throwIfPhantomRejected,
  toPhantomConnectPayload,
  toPhantomSignedTransactionPayload,
} from './wallet-connect.phantom.helpers';
import { WalletConnectSessionStore } from './wallet-connect.session-store';
import { escapeHtml, getWalletConnectErrorMessage } from './wallet-connect.utils';
import type { IAggregator, ISwapTransaction } from '../aggregators/interfaces/aggregator.interface';
import { SolanaChain } from '../chains/solana/solana.chain';
import { BusinessException } from '../common/exceptions/business.exception';
import { SwapExecutionAuditService } from '../swap/swap-execution-audit.service';

@Injectable()
export class WalletConnectPhantomService {
  private readonly logger = new Logger(WalletConnectPhantomService.name);
  private readonly appPublicUrl: string;
  private readonly swapTimeoutSeconds: number;
  private readonly telegramBotToken: string;

  @Inject(AGGREGATORS_TOKEN)
  private readonly aggregators!: readonly IAggregator[];

  public constructor(
    private readonly configService: ConfigService,
    private readonly sessionStore: WalletConnectSessionStore,
    private readonly swapExecutionAuditService: SwapExecutionAuditService,
    private readonly solanaChain: SolanaChain,
  ) {
    this.appPublicUrl = this.configService.get<string>('APP_PUBLIC_URL') ?? DEFAULT_APP_PUBLIC_URL;
    this.swapTimeoutSeconds = this.resolveTimeoutSeconds();
    this.telegramBotToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
  }

  public async createConnectionSession(
    input: ICreateWalletConnectConnectionInput,
  ): Promise<IWalletConnectSessionPublic> {
    const session = this.createBaseSession(input.userId, 'connect');

    this.sessionStore.save(session);

    return {
      sessionId: session.sessionId,
      uri: session.uri,
      expiresAt: new Date(session.expiresAt).toISOString(),
      walletDelivery: 'app-link',
    };
  }

  public async createSession(
    input: ICreateWalletConnectSessionInput,
  ): Promise<IWalletConnectSessionPublic> {
    const session = this.createBaseSession(input.userId, 'swap', input.swapPayload);

    this.sessionStore.save(session);

    return {
      sessionId: session.sessionId,
      uri: session.uri,
      expiresAt: new Date(session.expiresAt).toISOString(),
      walletDelivery: 'app-link',
    };
  }

  public async createSwapSessionFromConnection(
    input: ICreateWalletConnectSessionInput,
    connection: IWalletConnectionSession,
  ): Promise<IWalletConnectSessionPublic> {
    if (!connection.phantom) {
      throw new BusinessException('Phantom connection is not available');
    }

    const session = this.createBaseSession(
      input.userId,
      'swap',
      input.swapPayload,
      connection.phantom,
    );
    this.sessionStore.save(session);

    const transaction = await this.buildSwapTransaction(session.sessionId, connection.address);
    const signUrl = buildPhantomSignTransactionUrl({
      configService: this.configService,
      session,
      transaction,
      phantomState: connection.phantom,
      sessionStore: this.sessionStore,
    });

    return {
      sessionId: session.sessionId,
      uri: signUrl,
      expiresAt: new Date(session.expiresAt).toISOString(),
      walletDelivery: 'app-link',
    };
  }

  public getPhantomConnectUrl(sessionId: string): string {
    return this.getSolanaSession(sessionId).uri;
  }

  public async handleConnectCallback(query: IPhantomCallbackQuery): Promise<string | null> {
    const session = this.getSolanaSession(query.sessionId);
    const phantomState = this.ensurePhantomState(session);

    try {
      throwIfPhantomRejected(query, 'Подключение Phantom было отклонено');
      const phantomEncryptionPublicKey = getRequiredQueryValue(
        query.phantom_encryption_public_key,
        'phantom_encryption_public_key',
      );
      const sharedSecret = nacl.box.before(
        decodeBase58(phantomEncryptionPublicKey, 'phantom_encryption_public_key'),
        decodeBase58(phantomState.dappEncryptionSecretKey, 'dapp_encryption_secret_key'),
      );
      const connectPayload = toPhantomConnectPayload(
        decryptPhantomPayload(
          getRequiredQueryValue(query.data, 'data'),
          getRequiredQueryValue(query.nonce, 'nonce'),
          sharedSecret,
        ),
      );

      session.phantom = {
        ...phantomState,
        sharedSecret: encodeBase58(sharedSecret, 'sharedSecret'),
        phantomEncryptionPublicKey,
        phantomSession: getRequiredPayloadValue(connectPayload.session, 'session'),
        walletAddress: getRequiredPayloadValue(connectPayload.public_key, 'public_key'),
      };
      this.saveReusableConnection(session);

      if (session.kind === 'connect') {
        await this.sendTelegramMessage(
          session.userId,
          [
            'Phantom подключён.',
            `Адрес: <code>${escapeHtml(session.phantom.walletAddress ?? '')}</code>`,
          ].join('\n'),
        );
        this.sessionStore.delete(session.sessionId);
        return null;
      }

      const connectedState = this.getConnectedPhantomState(session);
      const transaction = await this.buildSwapTransaction(
        session.sessionId,
        getRequiredPayloadValue(connectedState.walletAddress, 'walletAddress'),
      );

      return buildPhantomSignTransactionUrl({
        configService: this.configService,
        session,
        transaction,
        phantomState: connectedState,
        sessionStore: this.sessionStore,
      });
    } catch (error: unknown) {
      const message = getWalletConnectErrorMessage(error);
      if (session.swapPayload) {
        await this.swapExecutionAuditService.markError(
          session.swapPayload.executionId,
          session.swapPayload.aggregatorName,
          session.swapPayload.feeMode,
          message,
        );
      }
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
    const swapPayload = this.getSwapPayload(session);

    try {
      throwIfPhantomRejected(query, 'Подпись в Phantom была отклонена');
      const phantomState = this.getConnectedPhantomState(session);
      const signedPayload = toPhantomSignedTransactionPayload(
        decryptPhantomPayload(
          getRequiredQueryValue(query.data, 'data'),
          getRequiredQueryValue(query.nonce, 'nonce'),
          decodeBase58(
            getRequiredPayloadValue(phantomState.sharedSecret, 'sharedSecret'),
            'sharedSecret',
          ),
        ),
      );
      const transactionHash = await this.solanaChain.broadcastSignedTransaction(
        Uint8Array.from(
          decodeBase58(
            getRequiredPayloadValue(signedPayload.transaction, 'transaction'),
            'transaction',
          ),
        ),
        getRequiredLastValidBlockHeight(session),
      );
      const explorerUrl = buildSolanaExplorerUrl(this.configService, transactionHash);

      await this.sendTelegramMessage(
        session.userId,
        [
          'Своп отправлен.',
          'Сеть: solana',
          `Агрегатор: ${swapPayload.aggregatorName}`,
          `Tx: <code>${escapeHtml(transactionHash)}</code>`,
          `<a href="${explorerUrl}">Открыть в эксплорере</a>`,
        ].join('\n'),
      );
      await this.swapExecutionAuditService.markSuccess(
        swapPayload.executionId,
        swapPayload.aggregatorName,
        swapPayload.feeMode,
        transactionHash,
      );

      return {
        explorerUrl,
        transactionHash,
      };
    } catch (error: unknown) {
      const message = getWalletConnectErrorMessage(error);
      await this.swapExecutionAuditService.markError(
        swapPayload.executionId,
        swapPayload.aggregatorName,
        swapPayload.feeMode,
        message,
      );
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
    const aggregator = this.resolveAggregator(this.getSwapPayload(session).aggregatorName);
    const swapPayload = this.getSwapPayload(session);

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

  private createBaseSession(
    userId: string,
    kind: 'connect' | 'swap',
    swapPayload?: ICreateWalletConnectSessionInput['swapPayload'],
    initialPhantomState?: IPhantomSessionState,
  ): IWalletConnectSession {
    const sessionId = randomUUID();
    const expiresAt = Date.now() + this.swapTimeoutSeconds * 1_000;
    const phantomState = initialPhantomState ?? this.createInitialPhantomState();

    const session: IWalletConnectSession = {
      sessionId,
      userId,
      uri: buildPhantomUrl(PHANTOM_CONNECT_METHOD, {
        dapp_encryption_public_key: phantomState.dappEncryptionPublicKey,
        cluster: PHANTOM_CLUSTER,
        app_url: this.appPublicUrl,
        redirect_link: buildAppUrl(this.appPublicUrl, PHANTOM_CONNECT_CALLBACK_PATH, sessionId),
      }),
      expiresAt,
      kind,
      family: 'solana',
      chain: 'solana',
      phantom: phantomState,
    };

    if (swapPayload) {
      session.swapPayload = swapPayload;
    }

    return session;
  }

  private createInitialPhantomState(): IPhantomSessionState {
    const keyPair = nacl.box.keyPair();

    return {
      dappEncryptionPublicKey: encodeBase58(keyPair.publicKey, 'dappEncryptionPublicKey'),
      dappEncryptionSecretKey: encodeBase58(keyPair.secretKey, 'dappEncryptionSecretKey'),
    };
  }

  private resolveTimeoutSeconds(): number {
    const rawTimeout = this.configService.get<string>('SWAP_TIMEOUT_SECONDS');
    const parsedTimeout = Number.parseInt(rawTimeout ?? `${DEFAULT_SWAP_TIMEOUT_SECONDS}`, 10);

    if (!Number.isInteger(parsedTimeout) || parsedTimeout < MIN_SWAP_TIMEOUT_SECONDS) {
      return DEFAULT_SWAP_TIMEOUT_SECONDS;
    }

    return parsedTimeout;
  }

  private getSolanaSession(sessionId: string): IWalletConnectSession {
    const session = this.sessionStore.get(sessionId);

    if (session?.family !== 'solana') {
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

  private getSwapPayload(session: IWalletConnectSession): IWalletConnectSwapPayload {
    if (!session.swapPayload) {
      throw new BusinessException('Solana swap payload is not initialized');
    }

    return session.swapPayload;
  }

  private saveReusableConnection(session: IWalletConnectSession): void {
    const phantomState = this.getConnectedPhantomState(session);
    const now = Date.now();

    this.sessionStore.saveConnection({
      userId: session.userId,
      family: 'solana',
      chain: 'solana',
      address: phantomState.walletAddress ?? '',
      walletLabel: 'Phantom',
      connectedAt: now,
      lastUsedAt: now,
      expiresAt: session.expiresAt,
      phantom: {
        ...phantomState,
      },
    });
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
