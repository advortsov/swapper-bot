import { Injectable } from '@nestjs/common';

import { BusinessException } from '../common/exceptions/business.exception';
import type { IPriceRequest } from '../price/interfaces/price.interface';
import { PriceQuoteService } from '../price/price.quote.service';
import type { ISwapRequest, ISwapSessionResponse } from './interfaces/swap.interface';
import { WalletConnectService } from '../wallet-connect/wallet-connect.service';

const ETHEREUM_CHAIN = 'ethereum';

@Injectable()
export class SwapService {
  public constructor(
    private readonly priceQuoteService: PriceQuoteService,
    private readonly walletConnectService: WalletConnectService,
  ) {}

  public async createSwapSession(request: ISwapRequest): Promise<ISwapSessionResponse> {
    const preparedInput = await this.priceQuoteService.prepare(
      this.toPriceRequest(request.userId, request),
    );
    const quoteSelection = await this.priceQuoteService.fetchQuoteSelection(preparedInput);
    const bestQuote = quoteSelection.bestQuote;

    if (bestQuote.toAmountBaseUnits.trim() === '') {
      throw new BusinessException('Best quote is empty');
    }

    const walletConnectSession = this.walletConnectService.createSession({
      userId: request.userId,
      swapPayload: {
        chain: ETHEREUM_CHAIN,
        aggregatorName: bestQuote.aggregatorName,
        sellTokenAddress: preparedInput.fromToken.address,
        buyTokenAddress: preparedInput.toToken.address,
        sellAmountBaseUnits: preparedInput.sellAmountBaseUnits,
        slippagePercentage: 0,
      },
    });

    const priceResponse = this.priceQuoteService.buildResponse(preparedInput, quoteSelection);

    return {
      chain: priceResponse.chain,
      aggregator: priceResponse.aggregator,
      fromSymbol: priceResponse.fromSymbol,
      toSymbol: priceResponse.toSymbol,
      fromAmount: priceResponse.fromAmount,
      toAmount: priceResponse.toAmount,
      providersPolled: priceResponse.providersPolled,
      providerQuotes: priceResponse.providerQuotes,
      walletConnectUri: walletConnectSession.uri,
      sessionId: walletConnectSession.sessionId,
      expiresAt: walletConnectSession.expiresAt,
    };
  }

  private toPriceRequest(userId: string, request: ISwapRequest): IPriceRequest {
    return {
      userId,
      amount: request.amount,
      fromSymbol: request.fromSymbol,
      toSymbol: request.toSymbol,
      rawCommand: request.rawCommand,
    };
  }
}
