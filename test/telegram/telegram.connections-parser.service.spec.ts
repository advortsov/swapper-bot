import { describe, expect, it } from 'vitest';

import { TelegramConnectionsParserService } from '../../src/telegram/telegram.connections-parser.service';

describe('TelegramConnectionsParserService', () => {
  it('должен парсить chain из connect/disconnect команд', () => {
    const service = new TelegramConnectionsParserService();

    expect(service.parseConnectChain('/connect on arbitrum')).toBe('arbitrum');
    expect(service.parseDisconnectChain('/disconnect on solana')).toBe('solana');
  });

  it('должен определять action prefixes и семейство цепочек', () => {
    const service = new TelegramConnectionsParserService();

    expect(service.isConnectAction('conn:start:evm')).toBe(true);
    expect(service.isDisconnectAction('conn:drop:solana')).toBe(true);
    expect(service.resolveConnectActionChain('conn:start:evm')).toBe('ethereum');
    expect(service.resolveDisconnectActionChain('conn:drop:solana')).toBe('solana');
  });
});
