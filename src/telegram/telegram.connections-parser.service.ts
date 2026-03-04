import { Injectable } from '@nestjs/common';

import type { ChainType } from '../chains/interfaces/chain.interface';
import { SUPPORTED_CHAINS } from '../chains/interfaces/chain.interface';
import { BusinessException } from '../common/exceptions/business.exception';
import { type WalletConnectService } from '../wallet-connect/wallet-connect.service';

const CONNECT_COMMAND_REGEX = /^\/connect(?:\s+on\s+([a-zA-Z0-9_-]+))?$/i;
const DISCONNECT_COMMAND_REGEX = /^\/disconnect(?:\s+on\s+([a-zA-Z0-9_-]+))?$/i;
const CONNECT_START_PREFIX = 'conn:start:';
const CONNECT_DROP_PREFIX = 'conn:drop:';
const SUPPORTED_CHAIN_SET = new Set<ChainType>(SUPPORTED_CHAINS);

@Injectable()
export class TelegramConnectionsParserService {
  public isConnectAction(data: string): boolean {
    return data.startsWith(CONNECT_START_PREFIX);
  }

  public isDisconnectAction(data: string): boolean {
    return data.startsWith(CONNECT_DROP_PREFIX);
  }

  public parseConnectChain(text: string): ChainType | null {
    const matches = CONNECT_COMMAND_REGEX.exec(text);

    if (!matches) {
      throw new BusinessException('Команда не распознана. Пример: /connect on ethereum');
    }

    return matches[1] ? this.resolveChain(matches[1]) : null;
  }

  public parseDisconnectChain(text: string): ChainType | null {
    const matches = DISCONNECT_COMMAND_REGEX.exec(text);

    if (!matches) {
      throw new BusinessException('Команда не распознана. Пример: /disconnect on solana');
    }

    return matches[1] ? this.resolveChain(matches[1]) : null;
  }

  public resolveConnectActionChain(data: string): ChainType {
    const family = data.slice(CONNECT_START_PREFIX.length);
    return family === 'solana' ? 'solana' : 'ethereum';
  }

  public resolveDisconnectActionChain(data: string): ChainType {
    const family = data.slice(CONNECT_DROP_PREFIX.length);
    return family === 'solana' ? 'solana' : 'ethereum';
  }

  public buildConnectionButtons(
    status: ReturnType<WalletConnectService['getConnectionStatus']>,
  ): { text: string; callback_data: string }[][] {
    return [
      [
        {
          text: status.evm ? 'Отключить EVM' : 'Подключить EVM',
          callback_data: `${status.evm ? CONNECT_DROP_PREFIX : CONNECT_START_PREFIX}evm`,
        },
        {
          text: status.solana ? 'Отключить Solana' : 'Подключить Solana',
          callback_data: `${status.solana ? CONNECT_DROP_PREFIX : CONNECT_START_PREFIX}solana`,
        },
      ],
    ];
  }

  private resolveChain(rawValue: string): ChainType {
    const chain = rawValue.toLowerCase() as ChainType;

    if (!SUPPORTED_CHAIN_SET.has(chain)) {
      throw new BusinessException(
        `Сеть ${rawValue} не поддерживается. Доступно: ${SUPPORTED_CHAINS.join(', ')}`,
      );
    }

    return chain;
  }
}
