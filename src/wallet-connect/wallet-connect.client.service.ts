import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import SignClient from '@walletconnect/sign-client';

import { DEFAULT_APP_PUBLIC_URL } from './wallet-connect.constants';
import {
  createWalletConnectMetadata,
  registerWalletConnectClientEvents,
} from './wallet-connect.evm.helpers';
import { BusinessException } from '../common/exceptions/business.exception';

@Injectable()
export class WalletConnectClientService implements OnModuleInit {
  private readonly logger = new Logger(WalletConnectClientService.name);
  private readonly projectId: string;
  private readonly appPublicUrl: string;
  private signClient: SignClient | null = null;

  public constructor(private readonly configService: ConfigService) {
    this.projectId = this.configService.get<string>('WC_PROJECT_ID') ?? '';
    this.appPublicUrl = this.configService.get<string>('APP_PUBLIC_URL') ?? DEFAULT_APP_PUBLIC_URL;
  }

  public async onModuleInit(): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.warn('WalletConnect EVM flow is disabled: WC_PROJECT_ID is empty');
      return;
    }

    this.signClient = await SignClient.init({
      projectId: this.projectId,
      metadata: createWalletConnectMetadata(this.appPublicUrl),
    });
    registerWalletConnectClientEvents(this.signClient, this.logger);
  }

  public isEnabled(): boolean {
    return this.projectId.trim() !== '';
  }

  public ensureConfigured(): void {
    if (!this.isEnabled()) {
      throw new BusinessException('WC_PROJECT_ID is required for EVM WalletConnect flows');
    }
  }

  public async getClient(): Promise<SignClient> {
    this.signClient ??= await SignClient.init({
      projectId: this.projectId,
      metadata: createWalletConnectMetadata(this.appPublicUrl),
    });
    registerWalletConnectClientEvents(this.signClient, this.logger);

    return this.signClient;
  }
}
