import type SignClient from '@walletconnect/sign-client';
import type { SessionTypes } from '@walletconnect/types';

import type {
  IWalletConnectSession,
  IWalletConnectSessionPublic,
} from './interfaces/wallet-connect.interface';
import { getWalletConnectChainConfig } from './wallet-connect.evm.helpers';
import type { ChainType } from '../chains/interfaces/chain.interface';
import { BusinessException } from '../common/exceptions/business.exception';

export async function createWalletConnectSessionRecord(input: {
  approvalPayload?: IWalletConnectSession['approvalPayload'];
  kind: IWalletConnectSession['kind'];
  signClient: SignClient;
  swapPayload?: IWalletConnectSession['swapPayload'];
  swapTimeoutSeconds: number;
  userId: string;
  sessionIdFactory: () => string;
  chain: ChainType;
}): Promise<{
  approval: () => Promise<SessionTypes.Struct>;
  publicSession: IWalletConnectSessionPublic;
  session: IWalletConnectSession;
}> {
  const chainConfig = getWalletConnectChainConfig(input.chain);
  const { uri, approval } = await input.signClient.connect({
    requiredNamespaces: {
      [chainConfig.namespace]: {
        methods: [...chainConfig.methods],
        chains: [chainConfig.chainId],
        events: [...chainConfig.events],
      },
    },
  });

  if (!uri) {
    throw new BusinessException('Failed to create WalletConnect URI');
  }

  const sessionId = input.sessionIdFactory();
  const expiresAt = Date.now() + input.swapTimeoutSeconds * 1_000;
  const session: IWalletConnectSession = {
    sessionId,
    userId: input.userId,
    uri,
    expiresAt,
    kind: input.kind,
    family: 'evm',
    chain: input.chain,
    ...(input.swapPayload ? { swapPayload: input.swapPayload } : {}),
    ...(input.approvalPayload ? { approvalPayload: input.approvalPayload } : {}),
  };

  return {
    approval,
    publicSession: {
      sessionId,
      uri,
      expiresAt: new Date(expiresAt).toISOString(),
      walletDelivery: 'qr',
    },
    session,
  };
}
