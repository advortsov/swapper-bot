import { Injectable } from '@nestjs/common';

import type { IPriceCommandDto } from './dto/price-command.dto';
import type { ISwapCommandDto } from './dto/swap-command.dto';
import type { ApprovalMode } from '../allowance/interfaces/allowance.interface';
import type { ChainType } from '../chains/interfaces/chain.interface';
import { DEFAULT_CHAIN, SUPPORTED_CHAINS } from '../chains/interfaces/chain.interface';
import { BusinessException } from '../common/exceptions/business.exception';

const PRICE_COMMAND_REGEX =
  /^\/price\s+([0-9]*\.?[0-9]+)\s+([a-zA-Z0-9]+)\s+to\s+([a-zA-Z0-9]+)(?:\s+on\s+([a-zA-Z0-9_-]+))?$/i;
const SWAP_COMMAND_REGEX =
  /^\/swap\s+([0-9]*\.?[0-9]+)\s+([a-zA-Z0-9]+)\s+to\s+([a-zA-Z0-9]+)(?:\s+on\s+([a-zA-Z0-9_-]+))?$/i;
const APPROVE_COMMAND_REGEX =
  /^\/approve\s+([0-9]*\.?[0-9]+)\s+([a-zA-Z0-9]+)(?:\s+on\s+([a-zA-Z0-9_-]+))?$/i;
const SUPPORTED_CHAIN_SET = new Set<ChainType>(SUPPORTED_CHAINS);
const AMOUNT_MATCH_INDEX = 1;
const FROM_SYMBOL_MATCH_INDEX = 2;
const TO_SYMBOL_MATCH_INDEX = 3;
const CHAIN_MATCH_INDEX = 4;
const APPROVE_TOKEN_MATCH_INDEX = 2;
const APPROVE_CHAIN_MATCH_INDEX = 3;
const SWAP_CALLBACK_PREFIX = 'sw:';
const APPROVE_CALLBACK_PREFIX = 'apr:';

export interface IApproveCallbackPayload {
  actionToken: string;
  aggregatorName: string;
  mode: ApprovalMode;
}

@Injectable()
export class TelegramTradingParserService {
  public parsePriceCommand(text: string): IPriceCommandDto {
    const matches = PRICE_COMMAND_REGEX.exec(text);

    if (!matches) {
      throw new BusinessException(
        'Команда не распознана. Пример: /price 10 USDC to USDT on ethereum',
      );
    }

    return {
      amount: this.getMatch(matches, AMOUNT_MATCH_INDEX),
      fromTokenInput: this.getMatch(matches, FROM_SYMBOL_MATCH_INDEX),
      toTokenInput: this.getMatch(matches, TO_SYMBOL_MATCH_INDEX),
      chain: this.resolveChain(matches[CHAIN_MATCH_INDEX]),
      explicitChain: Boolean(matches[CHAIN_MATCH_INDEX]),
    };
  }

  public parseSwapCommand(text: string): ISwapCommandDto {
    const matches = SWAP_COMMAND_REGEX.exec(text);

    if (!matches) {
      throw new BusinessException(
        'Команда не распознана. Пример: /swap 10 USDC to USDT on ethereum',
      );
    }

    return {
      amount: this.getMatch(matches, AMOUNT_MATCH_INDEX),
      fromTokenInput: this.getMatch(matches, FROM_SYMBOL_MATCH_INDEX),
      toTokenInput: this.getMatch(matches, TO_SYMBOL_MATCH_INDEX),
      chain: this.resolveChain(matches[CHAIN_MATCH_INDEX]),
      explicitChain: Boolean(matches[CHAIN_MATCH_INDEX]),
    };
  }

  public parseApproveCommand(text: string): {
    amount: string;
    tokenInput: string;
    chain: ChainType;
    explicitChain: boolean;
  } {
    const matches = APPROVE_COMMAND_REGEX.exec(text);

    if (!matches) {
      throw new BusinessException('Команда не распознана. Пример: /approve 100 USDC on ethereum');
    }

    return {
      amount: this.getMatch(matches, AMOUNT_MATCH_INDEX),
      tokenInput: this.getMatch(matches, APPROVE_TOKEN_MATCH_INDEX),
      chain: this.resolveChain(matches[APPROVE_CHAIN_MATCH_INDEX]),
      explicitChain: Boolean(matches[APPROVE_CHAIN_MATCH_INDEX]),
    };
  }

  public parseSwapSelectionToken(data: string): string {
    const selectionToken = data.slice(SWAP_CALLBACK_PREFIX.length).trim();

    if (selectionToken === '') {
      throw new BusinessException('Неверные данные');
    }

    return selectionToken;
  }

  public parseApproveCallback(data: string): IApproveCallbackPayload {
    const [prefix, actionToken, aggregatorName, mode] = data.split(':');

    if (
      prefix !== 'apr' ||
      !actionToken ||
      !aggregatorName ||
      !mode ||
      !this.isApprovalMode(mode)
    ) {
      throw new BusinessException('Approve callback повреждён');
    }

    return {
      actionToken,
      aggregatorName,
      mode,
    };
  }

  public isSwapCallback(data: string): boolean {
    return data.startsWith(SWAP_CALLBACK_PREFIX);
  }

  public isApproveCallback(data: string): boolean {
    return data.startsWith(APPROVE_CALLBACK_PREFIX);
  }

  public buildSwapCallbackData(selectionToken: string): string {
    return `${SWAP_CALLBACK_PREFIX}${selectionToken}`;
  }

  private getMatch(matches: RegExpExecArray, index: number): string {
    const value = matches[index];

    if (!value) {
      throw new BusinessException('Команда не распознана');
    }

    return value.trim();
  }

  private resolveChain(rawValue: string | undefined): ChainType {
    if (!rawValue) {
      return DEFAULT_CHAIN;
    }

    const chain = rawValue.toLowerCase() as ChainType;

    if (!SUPPORTED_CHAIN_SET.has(chain)) {
      throw new BusinessException(
        `Сеть ${rawValue} не поддерживается. Доступно: ${SUPPORTED_CHAINS.join(', ')}`,
      );
    }

    return chain;
  }

  private isApprovalMode(value: string): value is ApprovalMode {
    return value === 'exact' || value === 'max';
  }
}
