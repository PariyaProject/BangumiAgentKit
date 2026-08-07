import { RetryOptions } from './retry.js';
import { MemoryCache, CacheKeyContext } from './cache.js';
export interface HttpClientConfig {
    baseUrl?: string;
    userAgent?: string;
    accessToken?: string;
    timeoutMs?: number;
    cache?: MemoryCache;
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
    fetchFn?: typeof fetch;
}
export declare class HttpClient {
    private baseUrl;
    private userAgent;
    private accessToken?;
    private timeoutMs;
    private cache;
    constructor(config?: HttpClientConfig);
    request<T>(options: HttpRequestOptions): Promise<T>;
}
//# sourceMappingURL=http-client.d.ts.map