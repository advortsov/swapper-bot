import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicClient, http, isAddress } from 'viem';
import { optimism } from 'viem/chains';

import { BusinessException } from '../../common/exceptions/business.exception';
import type { ChainType, IChain, ITransactionReceipt } from '../interfaces/chain.interface';

const NATIVE_ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const ETH_DECIMALS = 18;

const ERC20_DECIMALS_ABI = [
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const ERC20_BALANCE_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

@Injectable()
export class OptimismChain implements IChain {
  public readonly chainId: number = optimism.id;
  public readonly name: ChainType = 'optimism';

  private readonly client;

  public constructor(private readonly configService: ConfigService) {
    const rpcUrl = this.configService.get<string>('OPTIMISM_RPC_URL');

    this.client = createPublicClient({
      chain: optimism,
      transport: http(rpcUrl),
    });
  }

  public async getGasPrice(): Promise<bigint> {
    return this.client.getGasPrice();
  }

  public async getTokenDecimals(tokenAddress: string): Promise<number> {
    if (tokenAddress.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase()) {
      return ETH_DECIMALS;
    }

    if (!isAddress(tokenAddress, { strict: false })) {
      throw new BusinessException(`Invalid token address: ${tokenAddress}`);
    }

    return await this.client.readContract({
      address: tokenAddress,
      abi: ERC20_DECIMALS_ABI,
      functionName: 'decimals',
    });
  }

  public validateAddress(address: string): boolean {
    if (address.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase()) {
      return true;
    }

    return isAddress(address, { strict: false });
  }

  public buildExplorerUrl(txHash: string): string {
    const baseUrl =
      this.configService.get<string>('EXPLORER_URL_OPTIMISM') ??
      'https://optimistic.etherscan.io/tx/';
    return `${baseUrl}${txHash}`;
  }

  public async getTransactionReceipt(txHash: string): Promise<ITransactionReceipt | null> {
    try {
      const receipt = await this.client.getTransactionReceipt({
        hash: txHash as `0x${string}`,
      });

      return {
        status: receipt.status === 'success' ? 'confirmed' : 'failed',
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice.toString(),
      };
    } catch {
      return null;
    }
  }

  public async getBalance(walletAddress: string): Promise<bigint> {
    return this.client.getBalance({
      address: walletAddress as `0x${string}`,
    });
  }

  public async getTokenBalance(walletAddress: string, tokenAddress: string): Promise<bigint> {
    if (tokenAddress.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase()) {
      return this.getBalance(walletAddress);
    }

    if (!isAddress(tokenAddress, { strict: false })) {
      throw new BusinessException(`Invalid token address: ${tokenAddress}`);
    }

    return this.client.readContract({
      address: tokenAddress,
      abi: ERC20_BALANCE_ABI,
      functionName: 'balanceOf',
      args: [walletAddress as `0x${string}`],
    });
  }
}
