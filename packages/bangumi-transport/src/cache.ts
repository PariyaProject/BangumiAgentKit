import crypto from 'node:crypto';

export interface CacheKeyContext {
  operationId: string;
  pathParams?: Record<string, string | number>;
  queryParams?: Record<string, unknown>;
  isAuthenticated?: boolean;
  accountId?: string;
  nsfw?: boolean;
  locale?: string;
}

export function buildCacheKey(ctx: CacheKeyContext): string {
  const parts = [
    ctx.operationId,
    JSON.stringify(ctx.pathParams || {}),
    JSON.stringify(ctx.queryParams || {}),
    ctx.isAuthenticated ? 'auth:1' : 'auth:0',
    ctx.accountId || 'anon',
    ctx.nsfw ? 'nsfw:1' : 'nsfw:0',
    ctx.locale || 'zh-CN',
  ];

  const rawKey = parts.join('|');
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

export class MemoryCache {
  private store = new Map<string, CacheItem<unknown>>();
  private maxItems: number;

  constructor(maxItems = 500) {
    this.maxItems = maxItems;
  }

  get<T>(key: string): T | undefined {
    const item = this.store.get(key);
    if (!item) {
      return undefined;
    }

    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return item.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds: number): void {
    if (this.store.size >= this.maxItems) {
      // Evict oldest entry
      const firstKey = this.store.keys().next().value;
      if (firstKey) {
        this.store.delete(firstKey);
      }
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  clear(): void {
    this.store.clear();
  }
}
