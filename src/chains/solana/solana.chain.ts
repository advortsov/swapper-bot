import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Connection, PublicKey } from '@solana/web3.js';

import { BusinessException } from '../../common/exceptions/business.exception';
import type { ChainType, IChain } from '../interfaces/chain.interface';

const DEFAULT_SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com';
const DEFAULT_SOLANA_EXPLORER_URL = 'https://solscan.io/tx/';
const SOLANA_CHAIN_ID = 'solana:mainnet';
const SOLANA_NATIVE_TOKEN_ADDRESS = 'So11111111111111111111111111111111111111112';
const SOLANA_NATIVE_TOKEN_DECIMALS = 9;
const DEFAULT_SIGNATURE_FEE_LAMPORTS = 5_000n;

@Injectable()
export class SolanaChain implements IChain {
  public readonly chainId: string = SOLANA_CHAIN_ID;
  public readonly name: ChainType = 'solana';

  private readonly connection: Connection;

  public constructor(private readonly configService: ConfigService) {
    const rpcUrl = this.configService.get<string>('SOLANA_RPC_URL') ?? DEFAULT_SOLANA_RPC_URL;
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  public async getGasPrice(): Promise<bigint> {
    return Promise.resolve(DEFAULT_SIGNATURE_FEE_LAMPORTS);
  }

  public async getTokenDecimals(tokenAddress: string): Promise<number> {
    if (tokenAddress === SOLANA_NATIVE_TOKEN_ADDRESS) {
      return SOLANA_NATIVE_TOKEN_DECIMALS;
    }

    try {
      const accountInfo = await this.connection.getParsedAccountInfo(new PublicKey(tokenAddress));
      const value = accountInfo.value;

      if (!value || !('parsed' in value.data)) {
        throw new BusinessException(`Failed to resolve Solana token decimals: ${tokenAddress}`);
      }

      const parsed = value.data.parsed as { info?: { decimals?: number } };
      const decimals = parsed.info?.decimals;

      if (typeof decimals !== 'number') {
        throw new BusinessException(`Failed to resolve Solana token decimals: ${tokenAddress}`);
      }

      return decimals;
    } catch (error: unknown) {
      if (error instanceof BusinessException) {
        throw error;
      }

      throw new BusinessException(`Invalid Solana token address: ${tokenAddress}`);
    }
  }

  public validateAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  public buildExplorerUrl(txHash: string): string {
    const baseUrl =
      this.configService.get<string>('EXPLORER_URL_SOLANA') ?? DEFAULT_SOLANA_EXPLORER_URL;
    return `${baseUrl}${txHash}`;
  }
}
