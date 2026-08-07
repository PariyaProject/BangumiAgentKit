export interface CacheKeyContext {
    operationId: string;
    pathParams?: Record<string, string | number>;
    queryParams?: Record<string, unknown>;
    isAuthenticated?: boolean;
    accountId?: string;
    nsfw?: boolean;
    locale?: string;
}
export declare function buildCacheKey(ctx: CacheKeyContext): string;
export declare class MemoryCache {
    private store;
    private maxItems;
    constructor(maxItems?: number);
    get<T>(key: string): T | undefined;
    set<T>(key: string, value: T, ttlSeconds: number): void;
    clear(): void;
}
//# sourceMappingURL=cache.d.ts.map