import { BangumiError, isBangumiError } from './errors.js';
import { withRetry, RetryOptions } from './retry.js';
import { MemoryCache, buildCacheKey, CacheKeyContext } from './cache.js';

export interface HttpClientConfig {
  baseUrl?: string;
  userAgent?: string;
  accessToken?: string;
  timeoutMs?: number;
  cache?: MemoryCache;
  fetchFn?: typeof fetch;
}

export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, unknown>;
  body?: unknown;
  accessToken?: string;
  cacheContext?: CacheKeyContext;
  cacheTtlSeconds?: number;
  retryOptions?: RetryOptions;
  /** Hard limit for the response body in UTF-8 bytes. */
  maxResponseBytes?: number;
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
}

export class HttpClient {
  private baseUrl: string;
  private userAgent: string;
  private accessToken?: string;
  private timeoutMs: number;
  private cache: MemoryCache;
  private fetchFn?: typeof fetch;

  constructor(config: HttpClientConfig = {}) {
    this.baseUrl = config.baseUrl || 'https://api.bgm.tv';
    this.userAgent =
      config.userAgent ||
      'Kurarion/BangumiAgentKit/0.1.0 (https://github.com/PariyaProject/BangumiAgentKit)';
    this.accessToken = config.accessToken;
    this.timeoutMs = config.timeoutMs ?? 10000;
    this.cache = config.cache || new MemoryCache();
    this.fetchFn = config.fetchFn;
  }

  async request<T>(options: HttpRequestOptions): Promise<T> {
    const method = (options.method || 'GET').toUpperCase() as HttpRequestOptions['method'];
    const isReadOnly = method === 'GET';
    const maxResponseBytes = normalizeResponseLimit(options.maxResponseBytes);

    // Check Cache
    let cacheKey: string | undefined;
    if (
      isReadOnly &&
      options.cacheContext &&
      options.cacheTtlSeconds &&
      options.cacheTtlSeconds > 0
    ) {
      cacheKey = buildCacheKey(options.cacheContext);
      const cached = this.cache.get<T>(cacheKey);
      if (cached !== undefined) {
        return cached;
      }
    }

    const executeRequest = async (): Promise<T> => {
      let url = `${this.baseUrl}${options.path}`;
      if (options.query) {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(options.query)) {
          if (v !== undefined && v !== null) {
            params.append(k, String(v));
          }
        }
        const queryString = params.toString();
        if (queryString) {
          url += `?${queryString}`;
        }
      }

      const token = options.accessToken || this.accessToken;
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'User-Agent': this.userAgent,
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      let reqBody: string | undefined = undefined;
      if (options.body) {
        headers['Content-Type'] = 'application/json';
        reqBody = JSON.stringify(options.body);
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      const abortRequest = () => controller.abort();
      if (options.signal) {
        if (options.signal.aborted) controller.abort();
        else options.signal.addEventListener('abort', abortRequest, { once: true });
      }

      const fetchImpl = options.fetchFn || this.fetchFn || fetch;

      let response: Response;
      try {
        response = await fetchImpl(url, {
          method,
          headers,
          body: reqBody,
          signal: controller.signal,
        });
      } catch (err: unknown) {
        clearTimeout(timer);
        if (isBangumiError(err)) {
          throw err;
        }
        if (err instanceof Error && err.name === 'AbortError') {
          throw new BangumiError(
            'NETWORK_ERROR',
            options.signal?.aborted
              ? 'Request cancelled by the caller.'
              : `Request timed out after ${this.timeoutMs}ms`,
            !options.signal?.aborted,
          );
        }
        throw new BangumiError(
          'NETWORK_ERROR',
          err instanceof Error ? err.message : 'Network failure',
          true,
        );
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', abortRequest);
      }

      if (response.status === 302 || response.status === 301 || response.headers.get('location')) {
        return { location: response.headers.get('location') || response.url || '' } as T;
      }

      assertResponseContentLength(response, maxResponseBytes);

      if (!response.ok) {
        let errorMsg = `HTTP ${response.status} ${response.statusText}`;
        try {
          const bodyText = await readResponseText(response, maxResponseBytes);
          if (bodyText) {
            try {
              const json = JSON.parse(bodyText);
              errorMsg = json.message || json.description || bodyText;
            } catch {
              errorMsg = bodyText;
            }
          }
        } catch {
          // ignore body read error
        }

        switch (response.status) {
          case 400:
            throw new BangumiError('VALIDATION_ERROR', errorMsg, false, 400);
          case 401:
            throw new BangumiError(
              'AUTH_REQUIRED',
              errorMsg,
              false,
              401,
              '调用 bangumi.auth_start',
            );
          case 403:
            throw new BangumiError('PERMISSION_DENIED', errorMsg, false, 403);
          case 404:
            throw new BangumiError('NOT_FOUND', errorMsg, false, 404);
          case 429:
            throw new BangumiError('RATE_LIMITED', errorMsg, true, 429);
          case 500:
          case 502:
          case 503:
          case 504:
            throw new BangumiError('UPSTREAM_UNAVAILABLE', errorMsg, true, response.status);
          default:
            throw new BangumiError('UNKNOWN_ERROR', errorMsg, false, response.status);
        }
      }

      if (response.status === 204) {
        return {} as T;
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.startsWith('image/')) {
        return { location: response.url || response.headers.get('location') || '' } as T;
      }

      let dataText = '';
      try {
        dataText = await readResponseText(response, maxResponseBytes);
        if (!dataText) {
          return {} as T;
        }
        const data = JSON.parse(dataText) as T;
        return data;
      } catch (error) {
        if (error instanceof BangumiError) throw error;
        if (contentType.includes('image') || response.status === 302) {
          return { location: response.url || response.headers.get('location') || '' } as T;
        }
        throw new BangumiError(
          'PARSER_ERROR',
          `Invalid JSON response: ${dataText.slice(0, 100)}`,
          false,
          response.status,
        );
      }
    };

    const result = await withRetry(
      executeRequest,
      Boolean(isReadOnly),
      options.retryOptions,
      options.signal,
    );

    if (cacheKey && options.cacheTtlSeconds) {
      this.cache.set(cacheKey, result, options.cacheTtlSeconds);
    }

    return result;
  }
}

function normalizeResponseLimit(value: number | undefined): number {
  return Number.isFinite(value) && value !== undefined && value > 0
    ? Math.floor(value)
    : Number.POSITIVE_INFINITY;
}

function assertResponseContentLength(response: Response, maxResponseBytes: number): void {
  if (!Number.isFinite(maxResponseBytes)) return;
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxResponseBytes) {
    throw new BangumiError(
      'RESPONSE_TOO_LARGE',
      `Response body is ${contentLength} bytes; limit is ${maxResponseBytes} bytes.`,
      false,
      response.status,
    );
  }
}

async function readResponseText(response: Response, maxResponseBytes: number): Promise<string> {
  assertResponseContentLength(response, maxResponseBytes);
  if (!Number.isFinite(maxResponseBytes) || !response.body) {
    const text = await response.text();
    if (
      Number.isFinite(maxResponseBytes) &&
      new TextEncoder().encode(text).byteLength > maxResponseBytes
    ) {
      throw new BangumiError(
        'RESPONSE_TOO_LARGE',
        `Response body exceeds the ${maxResponseBytes}-byte limit.`,
        false,
        response.status,
      );
    }
    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > maxResponseBytes) {
        await reader.cancel();
        throw new BangumiError(
          'RESPONSE_TOO_LARGE',
          `Response body exceeds the ${maxResponseBytes}-byte limit.`,
          false,
          response.status,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
