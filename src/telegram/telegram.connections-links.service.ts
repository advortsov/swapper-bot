import { Injectable } from '@nestjs/common';

const METAMASK_UNIVERSAL_LINK = 'https://link.metamask.io/wc?uri=';
const METAMASK_LEGACY_LINK = 'https://metamask.app.link/wc?uri=';
const TRUST_WALLET_UNIVERSAL_LINK = 'https://link.trustwallet.com/wc?uri=';

@Injectable()
export class TelegramConnectionsLinksService {
  public buildEvmWalletKeyboard(uri: string): { text: string; url: string }[][] {
    return [
      [
        {
          text: 'Open in MetaMask',
          url: `${METAMASK_UNIVERSAL_LINK}${encodeURIComponent(uri)}`,
        },
        {
          text: 'Open in Trust Wallet',
          url: `${TRUST_WALLET_UNIVERSAL_LINK}${encodeURIComponent(uri)}`,
        },
      ],
      [
        {
          text: 'MetaMask (legacy link)',
          url: `${METAMASK_LEGACY_LINK}${encodeURIComponent(uri)}`,
        },
      ],
    ];
  }

  public buildSolanaWalletKeyboard(uri: string): { text: string; url: string }[][] {
    return [[{ text: 'Open in Phantom', url: uri }]];
  }
}
