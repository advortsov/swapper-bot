import { BusinessException } from '../common/exceptions/business.exception';

export function getWalletConnectErrorMessage(error: unknown): string {
  if (error instanceof BusinessException) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;

    if (typeof errorObj['message'] === 'string') {
      return errorObj['message'];
    }

    if (typeof errorObj['code'] === 'string') {
      return `WalletConnect error: ${errorObj['code']}`;
    }

    if (typeof errorObj['data'] === 'string') {
      return `WalletConnect error: ${errorObj['data']}`;
    }
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown internal error';
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
