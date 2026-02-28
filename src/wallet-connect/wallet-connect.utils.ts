import { BusinessException } from '../common/exceptions/business.exception';

export function getWalletConnectErrorMessage(error: unknown): string {
  if (error instanceof BusinessException) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
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
