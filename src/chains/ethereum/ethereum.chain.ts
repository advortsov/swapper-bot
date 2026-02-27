import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicClient, http, isAddress } from 'viem';
import { mainnet } from 'viem/chains';

import { BusinessException } from '../../common/exceptions/business.exception';
import { ChainType, IChain } from '../interfaces/chain.interface';

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

@Injectable()
export class EthereumChain implements IChain {
  public readonly chainId: number = mainnet.id;
  public readonly name: ChainType = 'ethereum';

  private readonly client;

  public constructor(private readonly configService: ConfigService) {
    const rpcUrl = this.configService.get<string>('ETH_RPC_URL');

    this.client = createPublicClient({
      chain: mainnet,
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
      this.configService.get<string>('EXPLORER_URL_ETHEREUM') ?? 'https://etherscan.io/tx/';
    return `${baseUrl}${txHash}`;
  }
}
