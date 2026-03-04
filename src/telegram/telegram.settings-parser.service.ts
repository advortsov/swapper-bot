import { Injectable } from '@nestjs/common';

const CALLBACK_PREFIX = 's:';

export type SettingsCallbackAction =
  | { kind: 'menu' }
  | { kind: 'slippage-menu' }
  | { kind: 'slippage-custom' }
  | { kind: 'slippage-value'; value: number }
  | { kind: 'aggregator-menu' }
  | { kind: 'aggregator-value'; aggregatorName: string }
  | { kind: 'unknown' };

@Injectable()
export class TelegramSettingsParserService {
  public getCallbackPattern(): RegExp {
    return new RegExp(`^${CALLBACK_PREFIX}`);
  }

  public parseCallback(data: string): SettingsCallbackAction {
    if (data === 's:menu') {
      return { kind: 'menu' };
    }

    if (data === 's:slip:menu') {
      return { kind: 'slippage-menu' };
    }

    if (data === 's:slip:custom') {
      return { kind: 'slippage-custom' };
    }

    if (data.startsWith('s:slip:')) {
      return {
        kind: 'slippage-value',
        value: Number.parseFloat(data.slice('s:slip:'.length)),
      };
    }

    if (data === 's:agg:menu') {
      return { kind: 'aggregator-menu' };
    }

    if (data.startsWith('s:agg:')) {
      return {
        kind: 'aggregator-value',
        aggregatorName: data.slice('s:agg:'.length),
      };
    }

    return { kind: 'unknown' };
  }

  public parseText(messageInput: unknown): string {
    if (typeof messageInput !== 'object' || messageInput === null) {
      return '';
    }

    const text = (messageInput as { text?: unknown }).text;
    return typeof text === 'string' ? text.trim() : '';
  }
}
