import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Connection, PublicKey } from '@solana/web3.js';
import { createPublicClient, http, isAddress } from 'viem';

import { EVM_CHAINS, EVM_CHAIN_CONFIG, type IEvmChainType } from '../allowance/allowance.constants';
import type { ChainType } from '../chains/interfaces/chain.interface';
import { BusinessException } from '../common/exceptions/business.exception';

const ERC20_BALANCE_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const DEFAULT_SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com';
const SOLANA_NATIVE_TOKEN_ADDRESS = 'So11111111111111111111111111111111111111112';

@Injectable()
export class TokenBalanceReaderService {
  private readonly solanaConnection: Connection;

  public constructor(private readonly configService: ConfigService) {
    this.solanaConnection = new Connection(
      this.configService.get<string>('SOLANA_RPC_URL') ?? DEFAULT_SOLANA_RPC_URL,
      'confirmed',
    );
  }

  public async getEvmNativeBalance(walletAddress: string, chain: ChainType): Promise<string> {
    if (!EVM_CHAINS.includes(chain as IEvmChainType)) {
      throw new BusinessException('EVM balance only supported for EVM chains');
    }

    const config = EVM_CHAIN_CONFIG[chain as IEvmChainType];
    const client = createPublicClient({
      chain: config.chain,
      transport: http(this.configService.get<string>(config.envKey)),
    });

    const balance = await client.getBalance({
      address: walletAddress as `0x${string}`,
    });

    return balance.toString();
  }

  public async getEvmTokenBalance(
    walletAddress: string,
    tokenAddress: string,
    chain: ChainType,
  ): Promise<string> {
    if (!EVM_CHAINS.includes(chain as IEvmChainType)) {
      throw new BusinessException('EVM token balance only supported for EVM chains');
    }

    const config = EVM_CHAIN_CONFIG[chain as IEvmChainType];
    const client = createPublicClient({
      chain: config.chain,
      transport: http(this.configService.get<string>(config.envKey)),
    });

    if (!isAddress(tokenAddress, { strict: false })) {
      throw new BusinessException(`Invalid token address: ${tokenAddress}`);
    }

    const balance = await client.readContract({
      address: tokenAddress,
      abi: ERC20_BALANCE_ABI,
      functionName: 'balanceOf',
      args: [walletAddress as `0x${string}`],
    });

    return balance.toString();
  }

  public async getSolanaNativeBalance(walletAddress: string): Promise<string> {
    const result = await this.solanaConnection.getBalance(new PublicKey(walletAddress));
    return result.toString();
  }

  public async getSolanaTokenBalance(walletAddress: string, tokenAddress: string): Promise<string> {
    if (tokenAddress === SOLANA_NATIVE_TOKEN_ADDRESS) {
      return this.getSolanaNativeBalance(walletAddress);
    }

    try {
      const accounts = await this.solanaConnection.getTokenAccountsByOwner(
        new PublicKey(walletAddress),
        { mint: new PublicKey(tokenAddress) },
      );

      if (accounts.value.length === 0) {
        return '0';
      }

      const account = accounts.value[0];
      if (!account) {
        return '0';
      }

      const accountData = account.account.data;

      if (!('parsed' in accountData)) {
        return '0';
      }

      const parsed = accountData.parsed as { info: { tokenAmount: { amount: string } } };
      return parsed.info.tokenAmount.amount;
    } catch {
      throw new BusinessException(`Failed to get Solana token balance: ${tokenAddress}`);
    }
  }
}
