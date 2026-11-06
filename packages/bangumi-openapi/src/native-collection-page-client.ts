import { BangumiError, type HttpClient } from '@bangumi-agent-kit/bangumi-transport';

/** Source supplement: bangumi/server@243e2cd5, absent from the pinned OpenAPI. */
export const NATIVE_COLLECTION_PAGE_CONTRACT = 'server-243e2cd5-entity-page-v1';
export const NATIVE_COLLECTION_PAGE_MAX_BYTES = 256 * 1024;
export const NATIVE_COLLECTION_PAGE_DEADLINE_MS = 10_000;

export interface NativeCollectionPageQuery {
  limit: number;
  offset?: number;
}

export interface NativeCollectionPageOptions {
  signal?: AbortSignal;
  maxResponseBytes?: number;
}

export interface NativeCollectionPage {
  total: number;
  limit: number;
  offset: number;
  data: unknown[];
}

function validatePage(raw: unknown, limit: number, offset: number): NativeCollectionPage {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new BangumiError('PARSER_ERROR', 'Native collection page envelope is invalid.', false);
  }
  const page = raw as Record<string, unknown>;
  if (
    !Number.isSafeInteger(page.total) ||
    (page.total as number) < 0 ||
    page.limit !== limit ||
    page.offset !== offset ||
    !Array.isArray(page.data) ||
    page.data.length > limit ||
    ((page.total as number) > 0 && offset > (page.total as number))
  ) {
    throw new BangumiError(
      'PARSER_ERROR',
      'Native collection page bounds or metadata are incompatible.',
      false,
    );
  }
  // Count and hydration are separate upstream observations. Their disagreement
  // is reported by the semantic mapper; it must not invent snapshot consistency.
  return { total: page.total as number, limit, offset, data: page.data };
}

/** Two fixed source-owned reads; the raw generated operations remain unchanged. */
export class NativeCollectionPageClient {
  constructor(private readonly transport: HttpClient) {}

  getPersonPage(
    username: string,
    query: NativeCollectionPageQuery,
    options: NativeCollectionPageOptions = {},
  ): Promise<NativeCollectionPage> {
    return this.page('persons', username, query, options);
  }

  getCharacterPage(
    username: string,
    query: NativeCollectionPageQuery,
    options: NativeCollectionPageOptions = {},
  ): Promise<NativeCollectionPage> {
    return this.page('characters', username, query, options);
  }

  private async page(
    kind: 'persons' | 'characters',
    username: string,
    query: NativeCollectionPageQuery,
    options: NativeCollectionPageOptions,
  ): Promise<NativeCollectionPage> {
    const limit = query?.limit;
    const offset = query?.offset === undefined ? 0 : query.offset;
    const maxResponseBytes =
      options.maxResponseBytes === undefined
        ? NATIVE_COLLECTION_PAGE_MAX_BYTES
        : options.maxResponseBytes;
    if (
      typeof username !== 'string' ||
      username.length === 0 ||
      username.length > 80 ||
      username.trim() !== username ||
      username === '.' ||
      username === '..' ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      !Number.isSafeInteger(maxResponseBytes) ||
      maxResponseBytes < 1 ||
      maxResponseBytes > NATIVE_COLLECTION_PAGE_MAX_BYTES
    ) {
      throw new BangumiError('VALIDATION_ERROR', 'Native collection page input is invalid.', false);
    }
    const cancelled = () =>
      new BangumiError('NETWORK_ERROR', 'Native collection page cancelled or timed out.', false);
    if (options.signal?.aborted) throw cancelled();
    const controller = new AbortController();
    let rejectAbort!: (error: BangumiError) => void;
    const aborted = new Promise<never>((_resolve, reject) => {
      rejectAbort = reject;
    });
    const abort = () => {
      controller.abort();
      rejectAbort(cancelled());
    };
    options.signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, NATIVE_COLLECTION_PAGE_DEADLINE_MS);
    try {
      if (options.signal?.aborted) abort();
      if (controller.signal.aborted) return await aborted;
      const raw = await Promise.race([
        this.transport.request<unknown>({
          method: 'GET',
          path: `/v0/users/${encodeURIComponent(username)}/collections/-/${kind}`,
          query: { limit, offset },
          signal: controller.signal,
          maxResponseBytes,
          retryOptions: { maxRetries: 0 },
        }),
        aborted,
      ]);
      return validatePage(raw, limit, offset);
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
    }
  }
}
