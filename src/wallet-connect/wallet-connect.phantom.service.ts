import { Inject, Injectable } from '@nestjs/common';
import nacl from 'tweetnacl';

import type {
  ICreateWalletConnectConnectionInput,
  ICreateWalletConnectSessionInput,
  IPhantomCallbackQuery,
  IWalletConnectionSession,
  IWalletConnectSessionPublic,
} from './interfaces/wallet-connect.interface';
import { WalletConnectPhantomLinksService } from './wallet-connect.phantom-links.service';
import { WalletConnectPhantomMessagingService } from './wallet-connect.phantom-messaging.service';
import { WalletConnectPhantomStateService } from './wallet-connect.phantom-state.service';
import { WalletConnectPhantomTransactionService } from './wallet-connect.phantom-transaction.service';
import {
  decodeBase58,
  decryptPhantomPayload,
  encodeBase58,
  getRequiredPayloadValue,
  getRequiredQueryValue,
  throwIfPhantomRejected,
  toPhantomConnectPayload,
  toPhantomSignedTransactionPayload,
} from './wallet-connect.phantom.helpers';
import { WalletConnectSessionStore } from './wallet-connect.session-store';
import { getWalletConnectErrorMessage } from './wallet-connect.utils';
import type { ISwapTransaction } from '../aggregators/interfaces/aggregator.interface';
import { BusinessException } from '../common/exceptions/business.exception';
import { SwapExecutionAuditService } from '../swap/swap-execution-audit.service';

@Injectable()
export class WalletConnectPhantomService {
  @Inject()
  private readonly sessionStore!: WalletConnectSessionStore;

  @Inject()
  private readonly swapExecutionAuditService!: SwapExecutionAuditService;

  public constructor(
    private readonly linksService: WalletConnectPhantomLinksService,
    private readonly messagingService: WalletConnectPhantomMessagingService,
    private readonly phantomStateService: WalletConnectPhantomStateService,
    private readonly transactionService: WalletConnectPhantomTransactionService,
  ) {}

  public async createConnectionSession(
    input: ICreateWalletConnectConnectionInput,
  ): Promise<IWalletConnectSessionPublic> {
    return this.phantomStateService.createConnectionSession(input);
  }

  public async createSession(
    input: ICreateWalletConnectSessionInput,
  ): Promise<IWalletConnectSessionPublic> {
    return this.phantomStateService.createSwapSession(input);
  }

  public async createSwapSessionFromConnection(
    input: ICreateWalletConnectSessionInput,
    connection: IWalletConnectionSession,
  ): Promise<IWalletConnectSessionPublic> {
    if (!connection.phantom) {
      throw new BusinessException('Phantom connection is not available');
    }

    const session = this.phantomStateService.createSwapSessionFromConnection(
      input,
      connection.phantom,
    );
    const transaction = await this.transactionService.buildSwapTransaction(
      session,
      connection.address,
    );
    const signUrl = this.linksService.buildSignTransactionUrl(
      session,
      transaction,
      connection.phantom,
    );

    return {
      sessionId: session.sessionId,
      uri: signUrl,
      expiresAt: new Date(session.expiresAt).toISOString(),
      walletDelivery: 'app-link',
    };
  }

  public getPhantomConnectUrl(sessionId: string): string {
    return this.phantomStateService.getSolanaSession(sessionId).uri;
  }

  public async handleConnectCallback(query: IPhantomCallbackQuery): Promise<string | null> {
    const session = this.phantomStateService.getSolanaSession(query.sessionId);
    const phantomState = this.phantomStateService.ensurePhantomState(session);

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
      this.phantomStateService.saveReusableConnection(session);

      if (session.kind === 'connect') {
        await this.messagingService.sendConnectedMessage(
          session.userId,
          session.phantom.walletAddress ?? '',
        );
        this.sessionStore.delete(session.sessionId);
        return null;
      }

      const connectedState = this.phantomStateService.getConnectedPhantomState(session);
      const transaction = await this.transactionService.buildSwapTransaction(
        session,
        getRequiredPayloadValue(connectedState.walletAddress, 'walletAddress'),
      );

      return this.linksService.buildSignTransactionUrl(session, transaction, connectedState);
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
      await this.messagingService.sendErrorMessage(session.userId, message);
      throw new BusinessException(message);
    }
  }

  public async handleSignCallback(
    query: IPhantomCallbackQuery,
  ): Promise<{ explorerUrl: string; transactionHash: string }> {
    const session = this.phantomStateService.getSolanaSession(query.sessionId);
    const swapPayload = this.phantomStateService.getSwapPayload(session);

    try {
      throwIfPhantomRejected(query, 'Подпись в Phantom была отклонена');
      const phantomState = this.phantomStateService.getConnectedPhantomState(session);
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
      const result = await this.transactionService.broadcastSignedTransaction(
        session,
        Uint8Array.from(
          decodeBase58(
            getRequiredPayloadValue(signedPayload.transaction, 'transaction'),
            'transaction',
          ),
        ),
      );

      await this.messagingService.sendSwapSuccessMessage(
        session.userId,
        swapPayload,
        result.transactionHash,
        result.explorerUrl,
      );
      await this.swapExecutionAuditService.markSuccess(
        swapPayload.executionId,
        swapPayload.aggregatorName,
        swapPayload.feeMode,
        result.transactionHash,
      );

      return result;
    } catch (error: unknown) {
      const message = getWalletConnectErrorMessage(error);
      await this.swapExecutionAuditService.markError(
        swapPayload.executionId,
        swapPayload.aggregatorName,
        swapPayload.feeMode,
        message,
      );
      await this.messagingService.sendErrorMessage(session.userId, message);
      throw new BusinessException(message);
    } finally {
      this.sessionStore.delete(query.sessionId);
    }
  }

  public async buildSwapTransaction(
    sessionId: string,
    walletAddress: string,
  ): Promise<ISwapTransaction> {
    const session = this.phantomStateService.getSolanaSession(sessionId);
    return this.transactionService.buildSwapTransaction(session, walletAddress);
  }
}
