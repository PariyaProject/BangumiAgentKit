import { BangumiError } from './errors.js';

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  isReadOnly: boolean,
  options: RetryOptions = {},
  signal?: AbortSignal,
): Promise<T> {
  const maxRetries = options.maxRetries ?? 2;
  const initialDelayMs = options.initialDelayMs ?? 300;
  const maxDelayMs = options.maxDelayMs ?? 3000;

  let attempt = 0;

  while (true) {
    if (signal?.aborted) {
      throw new BangumiError('NETWORK_ERROR', 'Request cancelled by the caller.', false);
    }
    try {
      return await fn();
    } catch (err: unknown) {
      attempt++;

      // Write operations are NEVER retried automatically
      if (!isReadOnly) {
        throw err;
      }

      if (attempt > maxRetries) {
        throw err;
      }

      if (signal?.aborted) {
        throw new BangumiError('NETWORK_ERROR', 'Request cancelled by the caller.', false);
      }

      let isRetryable = false;
      if (err instanceof BangumiError) {
        isRetryable = err.retryable;
      } else if (err instanceof Error && (err.name === 'AbortError' || err.name === 'FetchError')) {
        isRetryable = true;
      }

      if (!isRetryable) {
        throw err;
      }

      // Calculate exponential backoff with jitter
      const expDelay = initialDelayMs * Math.pow(2, attempt - 1);
      const cappedDelay = Math.min(expDelay, maxDelayMs);
      const jitter = Math.random() * 0.3 * cappedDelay;
      const delay = Math.floor(cappedDelay + jitter);

      await new Promise<void>((resolve, reject) => {
        const timerRef: { current?: ReturnType<typeof setTimeout> } = {};
        const cleanup = () => {
          if (timerRef.current) clearTimeout(timerRef.current);
          signal?.removeEventListener('abort', abort);
        };
        const complete = () => {
          cleanup();
          resolve();
        };
        const abort = () => {
          cleanup();
          reject(new BangumiError('NETWORK_ERROR', 'Request cancelled by the caller.', false));
        };
        timerRef.current = setTimeout(complete, delay);
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) abort();
      });
    }
  }
}
