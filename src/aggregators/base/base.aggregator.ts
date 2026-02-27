import { BusinessException } from '../../common/exceptions/business.exception';

const REQUEST_TIMEOUT_MS = 10_000;

export abstract class BaseAggregator {
  protected async getJson(
    url: URL,
    headers: Record<string, string>,
  ): Promise<{ statusCode: number; body: unknown }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      const body = (await response.json()) as unknown;

      if (!response.ok) {
        throw new BusinessException(`Aggregator request failed with status ${response.status}`);
      }

      return {
        statusCode: response.status,
        body,
      };
    } catch (error: unknown) {
      if (error instanceof BusinessException) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new BusinessException('Aggregator request timed out');
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new BusinessException(`Aggregator request failed: ${message}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
