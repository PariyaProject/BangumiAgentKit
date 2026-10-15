import type {
  AssetHttpTransport,
  AssetHttpTransportOptions,
  AssetHttpTransportResponse,
  ApprovedAddress,
} from '@bangumi-agent-kit/renderer';

export type PublicRequestKind = 'bangumiApi' | 'rendererAsset';

export interface PublicRequestCounts {
  bangumiApi: number;
  rendererAsset: number;
  total: number;
  budgetBlocked: boolean;
}

export class PublicRequestBudget {
  private bangumiApi = 0;
  private rendererAsset = 0;
  private blocked = false;

  constructor(private readonly maxRequests: number) {
    if (!Number.isInteger(maxRequests) || maxRequests < 1) {
      throw new Error('Public request budget must be a positive integer.');
    }
  }

  reserve(kind: PublicRequestKind): void {
    if (this.total >= this.maxRequests) {
      this.blocked = true;
      throw new Error('PUBLIC_PROBE_REQUEST_BUDGET_EXCEEDED');
    }
    if (kind === 'bangumiApi') this.bangumiApi += 1;
    else this.rendererAsset += 1;
  }

  get total(): number {
    return this.bangumiApi + this.rendererAsset;
  }

  snapshot(): PublicRequestCounts {
    return {
      bangumiApi: this.bangumiApi,
      rendererAsset: this.rendererAsset,
      total: this.total,
      budgetBlocked: this.blocked,
    };
  }
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_API_REDIRECTS = 20;

/**
 * Count every public API request, including each redirect hop. This probe only
 * supports the GET/HEAD methods used by its fixed anonymous read scope.
 */
export function createBudgetedPublicFetch(
  budget: PublicRequestBudget,
  fetchImpl: typeof fetch = fetch,
): typeof fetch {
  return (async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    const request = new Request(input, init);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      throw new Error('The fixed public probe only permits GET or HEAD requests.');
    }

    let currentUrl = new URL(request.url);
    for (let redirectCount = 0; ; redirectCount += 1) {
      budget.reserve('bangumiApi');
      const response = await fetchImpl(currentUrl, {
        method: request.method,
        headers: request.headers,
        signal: request.signal,
        redirect: 'manual',
      });
      const location = response.headers.get('location');
      if (!REDIRECT_STATUSES.has(response.status) || !location) return response;
      if (redirectCount >= MAX_API_REDIRECTS) {
        await response.body?.cancel();
        throw new Error(`Public API redirect limit (${MAX_API_REDIRECTS}) exceeded.`);
      }

      await response.body?.cancel();
      currentUrl = new URL(location, currentUrl);
    }
  }) as typeof fetch;
}

export class BudgetedAssetHttpTransport implements AssetHttpTransport {
  constructor(
    private readonly budget: PublicRequestBudget,
    private readonly delegate: AssetHttpTransport,
  ) {}

  request(
    url: string,
    approvedAddress: ApprovedAddress,
    options?: AssetHttpTransportOptions,
  ): Promise<AssetHttpTransportResponse> {
    this.budget.reserve('rendererAsset');
    return this.delegate.request(url, approvedAddress, options);
  }
}
