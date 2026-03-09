import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { InternalApiGuard } from './internal-api.guard';
import { SwapExecutionsRepository } from '../database/repositories/swap-executions.repository';
import { SwapIntentsRepository } from '../database/repositories/swap-intents.repository';
import { TrackedTransactionsRepository } from '../database/repositories/tracked-transactions.repository';
import { PortfolioService } from '../portfolio/portfolio.service';
import type { IPriceRequest } from '../price/interfaces/price.interface';
import { PriceService } from '../price/price.service';
import type { ISwapRequest } from '../swap/interfaces/swap.interface';
import { SwapIntentService } from '../swap/swap-intent.service';
import { SwapService } from '../swap/swap.service';
import { WalletConnectSessionStore } from '../wallet-connect/wallet-connect.session-store';

interface IInternalSwapSelectionBody {
  userId: string;
  selectionToken: string;
}

@Controller('internal')
@UseGuards(InternalApiGuard)
export class InternalApiController {
  private readonly logger = new Logger(InternalApiController.name);

  @Inject()
  private readonly swapIntentsRepository!: SwapIntentsRepository;

  @Inject()
  private readonly swapExecutionsRepository!: SwapExecutionsRepository;

  @Inject()
  private readonly trackedTransactionsRepository!: TrackedTransactionsRepository;

  @Inject()
  private readonly walletConnectSessionStore!: WalletConnectSessionStore;

  public constructor(
    private readonly priceService: PriceService,
    private readonly swapService: SwapService,
    private readonly swapIntentService: SwapIntentService,
    private readonly portfolioService: PortfolioService,
  ) {}

  @Post('price')
  @HttpCode(HttpStatus.OK)
  public async getPrice(@Body() body: IPriceRequest): Promise<unknown> {
    try {
      return await this.priceService.getBestQuote(body);
    } catch (error: unknown) {
      this.logger.error('Price request failed', error);
      return { error: this.getErrorMessage(error) };
    }
  }

  @Post('swap-intents')
  @HttpCode(HttpStatus.OK)
  public async createSwapIntent(@Body() body: ISwapRequest): Promise<unknown> {
    try {
      return await this.swapService.getSwapQuotes(body);
    } catch (error: unknown) {
      this.logger.error('Swap intent creation failed', error);
      return { error: this.getErrorMessage(error) };
    }
  }

  @Post('swap-intents/:intentId/select')
  @HttpCode(HttpStatus.OK)
  public async selectSwapIntent(
    @Param('intentId') _intentId: string,
    @Body() body: IInternalSwapSelectionBody,
  ): Promise<unknown> {
    try {
      return await this.swapIntentService.consumeSelectionToken(body.userId, body.selectionToken);
    } catch (error: unknown) {
      this.logger.error('Selection token consumption failed', error);
      return { error: this.getErrorMessage(error) };
    }
  }

  @Get('swap-intents/:intentId')
  public async getSwapIntent(@Param('intentId') intentId: string): Promise<unknown> {
    try {
      const result = await this.swapIntentsRepository.findById(intentId);

      if (!result) {
        return { error: 'Intent not found' };
      }

      return result;
    } catch (error: unknown) {
      this.logger.error('Get swap intent failed', error);
      return { error: this.getErrorMessage(error) };
    }
  }

  @Get('swap-executions/:executionId')
  public async getSwapExecution(@Param('executionId') executionId: string): Promise<unknown> {
    try {
      const result = await this.swapExecutionsRepository.findById(executionId);

      if (!result) {
        return { error: 'Execution not found' };
      }

      return result;
    } catch (error: unknown) {
      this.logger.error('Get swap execution failed', error);
      return { error: this.getErrorMessage(error) };
    }
  }

  @Get('transactions/:hash')
  public async getTransaction(@Param('hash') hash: string): Promise<unknown> {
    try {
      const result = await this.trackedTransactionsRepository.findByHash(hash);

      if (!result) {
        return { error: 'Transaction not found' };
      }

      return result;
    } catch (error: unknown) {
      this.logger.error('Get transaction failed', error);
      return { error: this.getErrorMessage(error) };
    }
  }

  @Get('wallet-connections/:userId')
  public async getWalletConnections(@Param('userId') userId: string): Promise<unknown> {
    try {
      return this.walletConnectSessionStore.listConnections(userId);
    } catch (error: unknown) {
      this.logger.error('Get wallet connections failed', error);
      return { error: this.getErrorMessage(error) };
    }
  }

  @Get('portfolio/:userId')
  public async getPortfolio(@Param('userId') userId: string): Promise<unknown> {
    try {
      return await this.portfolioService.getUserPortfolio(userId);
    } catch (error: unknown) {
      this.logger.error('Get portfolio failed', error);
      return { error: this.getErrorMessage(error) };
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown error';
  }
}
