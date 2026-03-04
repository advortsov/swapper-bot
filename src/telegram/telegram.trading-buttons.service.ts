import { Injectable } from '@nestjs/common';

import { buildSwapButtonText } from './telegram.message-formatters';
import { TelegramTradingParserService } from './telegram.trading-parser.service';
import { AllowanceService } from '../allowance/allowance.service';
import type { IApproveOptionView } from '../allowance/interfaces/allowance.interface';
import type { IProviderQuote } from '../price/interfaces/price.interface';

@Injectable()
export class TelegramTradingButtonsService {
  public constructor(
    private readonly allowanceService: AllowanceService,
    private readonly telegramTradingParserService: TelegramTradingParserService,
  ) {}

  public buildSwapButtons(
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
            callback_data: this.telegramTradingParserService.buildSwapCallbackData(
              quote.selectionToken,
            ),
          },
        ],
      ];
    });
  }

  public buildApproveButtons(
    actionToken: string,
    options: readonly IApproveOptionView[],
  ): { text: string; callback_data: string }[][] {
    return options.flatMap((option) => [
      [
        {
          text: `${option.aggregatorName} · approve exact`,
          callback_data: this.allowanceService.buildApprovalCallbackData(
            actionToken,
            option.aggregatorName,
            'exact',
          ),
        },
      ],
      [
        {
          text: `${option.aggregatorName} · approve max`,
          callback_data: this.allowanceService.buildApprovalCallbackData(
            actionToken,
            option.aggregatorName,
            'max',
          ),
        },
      ],
    ]);
  }
}
