import { describe, expect, it } from 'vitest';

import type { IPriceResponse } from '../../src/price/interfaces/price.interface';
import type { ISwapSessionResponse } from '../../src/swap/interfaces/swap.interface';
import {
  buildHelpMessage,
  buildPreparedSwapMessage,
  buildPriceMessage,
  buildStartMessage,
} from '../../src/telegram/telegram.message-formatters';

describe('telegram.message-formatters', () => {
  it('должен строить подробное help-сообщение', () => {
    const message = buildHelpMessage();

    expect(message).toContain('ℹ️ <b>Справка по боту</b>');
    expect(message).toContain(
      '/price &lt;amount&gt; &lt;from&gt; to &lt;to&gt; [on &lt;chain&gt;]',
    );
    expect(message).toContain('/swap &lt;amount&gt; &lt;from&gt; to &lt;to&gt; [on &lt;chain&gt;]');
    expect(message).toContain('/connect [on &lt;chain&gt;]');
    expect(message).toContain('/favorites');
    expect(message).toContain('<b>Поддерживаемые сети</b>');
  });

  it('должен строить форматированную котировку', () => {
    const priceResponse: IPriceResponse = {
      chain: 'ethereum',
      aggregator: 'paraswap',
      fromSymbol: 'ETH',
      toSymbol: 'USDC',
      fromTokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      toTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      fromAmount: '0.1',
      toAmount: '198.42',
      grossToAmount: '198.72',
      feeAmount: '0.30',
      feeAmountSymbol: 'USDC',
      feeBps: 20,
      feeMode: 'enforced',
      feeType: 'partner fee',
      feeDisplayLabel: 'partner fee',
      estimatedGasUsd: 4.12,
      providersPolled: 3,
      providerQuotes: [
        {
          aggregator: 'paraswap',
          toAmount: '198.42',
          grossToAmount: '198.72',
          feeAmount: '0.30',
          feeAmountSymbol: 'USDC',
          feeBps: 20,
          feeMode: 'enforced',
          feeType: 'partner fee',
          feeDisplayLabel: 'partner fee',
          feeAppliedAtQuote: true,
          feeEnforcedOnExecution: true,
          estimatedGasUsd: 4.12,
        },
      ],
    };

    const message = buildPriceMessage(priceResponse);

    expect(message).toContain('📈 <b>Лучшая котировка</b>');
    expect(message).toContain('🔁 0.1 ETH → 198.42 USDC');
    expect(message).toContain('🌐 Сеть: <code>ethereum</code>');
    expect(message).toContain('🤖 Комиссия бота: 0.30 USDC (20 bps, partner fee)');
    expect(message).toContain('⛽ Газ: $4.1200');
    expect(message).toContain('<b>Котировки провайдеров</b>');
  });

  it('должен строить форматированное сообщение подготовленного свопа', () => {
    const session: ISwapSessionResponse = {
      intentId: 'intent-id',
      chain: 'solana',
      aggregator: 'jupiter',
      fromSymbol: 'SOL',
      toSymbol: 'USDC',
      fromAmount: '1',
      toAmount: '149.7',
      grossToAmount: '150',
      feeAmount: '0.3',
      feeAmountSymbol: 'USDC',
      feeBps: 20,
      feeMode: 'enforced',
      feeType: 'native fee',
      feeDisplayLabel: 'native fee',
      walletConnectUri: 'https://example.org',
      sessionId: 'session-id',
      expiresAt: '2026-03-03T10:30:00.000Z',
      quoteExpiresAt: '2026-03-03T10:25:00.000Z',
      walletDelivery: 'app-link',
    };

    const message = buildPreparedSwapMessage({
      session,
      expiresAtText: '03.03.2026 13:30',
      quoteExpiresAtText: '03.03.2026 13:25',
      swapValidityText: '5 мин',
      deliveryHint: 'Открой Phantom и подпиши транзакцию.',
    });

    expect(buildStartMessage()).toContain('👋 <b>Привет!</b>');
    expect(message).toContain('👛 <b>Своп подготовлен</b>');
    expect(message).toContain('🆔 Session ID: <code>session-id</code>');
    expect(message).toContain('⏳ Сессия истекает: <code>03.03.2026 13:30</code>');
    expect(message).toContain('ℹ️ Транзакция уже собрана с учётом комиссии бота.');
  });
});
