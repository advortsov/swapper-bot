import { Inject, Injectable } from '@nestjs/common';
import type { Context } from 'telegraf';

import { AllowanceService } from '../allowance/allowance.service';
import type { IPriceCommandDto } from './dto/price-command.dto';
import type { ISwapCommandDto } from './dto/swap-command.dto';
import { TelegramConnectionsService } from './telegram.connections.service';
import {
  buildApproveOptionsMessage,
  buildPriceMessage,
  buildSwapButtonText,
  buildSwapQuotesMessage,
} from './telegram.message-formatters';
import { TelegramPortfolioService } from './telegram.portfolio.service';
import { formatSwapValidity } from './telegram.time';
import type { ApprovalMode } from '../allowance/interfaces/allowance.interface';
import type { ChainType } from '../chains/interfaces/chain.interface';
import { DEFAULT_CHAIN, SUPPORTED_CHAINS } from '../chains/interfaces/chain.interface';
import { BusinessException } from '../common/exceptions/business.exception';
import { UsersRepository } from '../database/repositories/users.repository';
import type { IProviderQuote } from '../price/interfaces/price.interface';
import { PriceService } from '../price/price.service';
import { SwapService } from '../swap/swap.service';
import { WalletConnectService } from '../wallet-connect/wallet-connect.service';

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

@Injectable()
export class TelegramTradingService {
  @Inject()
  private readonly walletConnectService!: WalletConnectService;

  @Inject()
  private readonly allowanceService!: AllowanceService;

  public constructor(
    private readonly priceService: PriceService,
    private readonly swapService: SwapService,
    private readonly usersRepository: UsersRepository,
    private readonly portfolioService: TelegramPortfolioService,
  ) {}

  public async handlePrice(
    context: Context,
    userId: string,
    username: string | null,
    text: string,
  ): Promise<void> {
    const command = this.parsePriceCommand(text);
    await this.upsertUser(userId, username);

    const result = await this.priceService.getBestQuote({
      chain: command.chain,
      userId,
      amount: command.amount,
      fromTokenInput: command.fromTokenInput,
      toTokenInput: command.toTokenInput,
      rawCommand: text,
      explicitChain: command.explicitChain,
    });

    const keyboard = this.portfolioService.buildFavoriteActionButtons({
      chain: result.chain,
      amount: result.fromAmount,
      fromTokenAddress: result.fromTokenAddress,
      toTokenAddress: result.toTokenAddress,
      userId,
    });

    await context.reply(buildPriceMessage(result), {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  public async handleSwap(
    context: Context,
    userId: string,
    username: string | null,
    text: string,
  ): Promise<void> {
    const command = this.parseSwapCommand(text);
    await this.upsertUser(userId, username);

    const quotes = await this.swapService.getSwapQuotes({
      chain: command.chain,
      userId,
      amount: command.amount,
      fromTokenInput: command.fromTokenInput,
      toTokenInput: command.toTokenInput,
      rawCommand: text,
      explicitChain: command.explicitChain,
    });

    await context.reply(buildSwapQuotesMessage(quotes, formatSwapValidity(quotes.quoteExpiresAt)), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          ...this.buildSwapButtons(quotes.providerQuotes, quotes.toSymbol, quotes.aggregator),
          ...this.portfolioService.buildFavoriteActionButtons({
            chain: quotes.chain,
            amount: quotes.fromAmount,
            fromTokenAddress: quotes.fromTokenAddress,
            toTokenAddress: quotes.toTokenAddress,
            userId,
          }),
        ],
      },
    });
  }

  public async handleApprove(
    context: Context,
    userId: string,
    username: string | null,
    text: string,
  ): Promise<void> {
    const command = this.parseApproveCommand(text);
    await this.upsertUser(userId, username);

    const walletAddress =
      this.walletConnectService.getReusableSession(userId, command.chain)?.address ?? null;
    const result = await this.allowanceService.prepareApproveOptions({
      userId,
      amount: command.amount,
      tokenInput: command.tokenInput,
      chain: command.chain,
      explicitChain: command.explicitChain,
      walletAddress,
    });

    await context.reply(buildApproveOptionsMessage(result), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: result.options.flatMap((option) => [
          [
            {
              text: `${option.aggregatorName} · approve exact`,
              callback_data: this.allowanceService.buildApprovalCallbackData(
                result.actionToken,
                option.aggregatorName,
                'exact',
              ),
            },
          ],
          [
            {
              text: `${option.aggregatorName} · approve max`,
              callback_data: this.allowanceService.buildApprovalCallbackData(
                result.actionToken,
                option.aggregatorName,
                'max',
              ),
            },
          ],
        ]),
      },
    });
  }

  public async handleSwapCallback(
    context: Context,
    userId: string,
    data: string,
    connectionsService: TelegramConnectionsService,
  ): Promise<void> {
    const selectionToken = data.slice(SWAP_CALLBACK_PREFIX.length);

    if (selectionToken.trim() === '') {
      await context.answerCbQuery('Неверные данные');
      return;
    }

    await context.answerCbQuery('Подготовка свопа...');
    const session = await this.swapService.createSwapSessionFromSelection(userId, selectionToken);
    await connectionsService.replySwapSession(context, session);
  }

  public async handleApproveCallback(
    context: Context,
    userId: string,
    data: string,
    connectionsService: TelegramConnectionsService,
  ): Promise<void> {
    const prepared = this.parseApproveCallback(data, userId);

    await context.answerCbQuery('Подготовка approve...');
    const session = await this.walletConnectService.createApproveSession({
      userId,
      approvalPayload: this.allowanceService.toWalletConnectApprovalPayload(prepared),
    });
    await connectionsService.replyApproveSession(
      context,
      this.allowanceService.toApproveSessionResponse({
        prepared,
        session,
      }),
    );
  }

  public isSwapCallback(data: string): boolean {
    return data.startsWith(SWAP_CALLBACK_PREFIX);
  }

  public isApproveCallback(data: string): boolean {
    return data.startsWith(APPROVE_CALLBACK_PREFIX);
  }

  private buildSwapButtons(
    providerQuotes: readonly IProviderQuote[],
    toSymbol: string,
    bestAggregator: string,
  ): { text: string; callback_data: string }[][] {
    return providerQuotes.flatMap((quote) => {
      if (!quote.selectionToken) {
        return [];
      }

      return [
        [
          {
            text: buildSwapButtonText(quote, toSymbol, bestAggregator),
            callback_data: `${SWAP_CALLBACK_PREFIX}${quote.selectionToken}`,
          },
        ],
      ];
    });
  }

  private parsePriceCommand(text: string): IPriceCommandDto {
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

  private parseSwapCommand(text: string): ISwapCommandDto {
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

  private parseApproveCommand(text: string): {
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

  private parseApproveCallback(
    data: string,
    userId: string,
  ): ReturnType<AllowanceService['getPreparedApproveExecution']> {
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

    return this.allowanceService.getPreparedApproveExecution(
      userId,
      actionToken,
      aggregatorName,
      mode,
    );
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

  private async upsertUser(userId: string, username: string | null): Promise<void> {
    await this.usersRepository.upsertUser({ id: userId, username });
  }

  private isApprovalMode(value: string): value is ApprovalMode {
    return value === 'exact' || value === 'max';
  }
}
