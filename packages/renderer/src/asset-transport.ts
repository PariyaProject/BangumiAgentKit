import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns/promises';
import net from 'node:net';
import { URL } from 'node:url';
import { RendererError } from './errors.js';
import { isIpAddressBlocked } from './asset-resolver.js';

export interface ApprovedAddress {
  address: string;
  family: 4 | 6;
}

export interface AssetNetworkResolver {
  resolve(hostname: string): Promise<ApprovedAddress[]>;
}

export interface AssetHttpTransportResponse {
  status: number;
  headers: Record<string, string>;
  buffer: Buffer;
  url: string;
}

export interface AssetHttpTransportOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Record<string, string>;
  maxBytes?: number;
}

export interface AssetHttpTransport {
  request(
    urlStr: string,
    approvedAddress: ApprovedAddress,
    options?: AssetHttpTransportOptions,
  ): Promise<AssetHttpTransportResponse>;
}

export class DefaultAssetNetworkResolver implements AssetNetworkResolver {
  async resolve(hostname: string): Promise<ApprovedAddress[]> {
    if (net.isIP(hostname)) {
      if (isIpAddressBlocked(hostname)) {
        throw new RendererError('ASSET_URL_BLOCKED', `Blocked IP address "${hostname}".`);
      }
      return [{ address: hostname, family: net.isIPv6(hostname) ? 6 : 4 }];
    }

    try {
      const records = await dns.lookup(hostname, { all: true });
      if (!records || records.length === 0) {
        throw new RendererError(
          'ASSET_FETCH_FAILED',
          `DNS resolution returned empty for "${hostname}".`,
        );
      }

      const approved: ApprovedAddress[] = [];
      for (const rec of records) {
        if (isIpAddressBlocked(rec.address)) {
          throw new RendererError(
            'ASSET_URL_BLOCKED',
            `DNS resolved to blocked IP "${rec.address}" for host "${hostname}".`,
          );
        }
        approved.push({
          address: rec.address,
          family:
            rec.family === 6 || (typeof rec.family === 'string' && rec.family === 'IPv6') ? 6 : 4,
        });
      }
      return approved;
    } catch (err) {
      if (err instanceof RendererError) throw err;
      throw new RendererError(
        'ASSET_FETCH_FAILED',
        `DNS lookup failed for "${hostname}": ${String(err)}`,
      );
    }
  }
}

const ALLOWED_CONTENT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export class NodeAssetHttpTransport implements AssetHttpTransport {
  async request(
    urlStr: string,
    approvedAddress: ApprovedAddress,
    options?: AssetHttpTransportOptions,
  ): Promise<AssetHttpTransportResponse> {
    const parsed = new URL(urlStr);
    const isHttps = parsed.protocol === 'https:';
    const requestModule = isHttps ? https : http;
    const port = parsed.port ? parseInt(parsed.port, 10) : isHttps ? 443 : 80;
    const timeoutMs = options?.timeoutMs ?? 5000;
    const maxBytes = options?.maxBytes ?? 5 * 1024 * 1024;

    return new Promise((resolve, reject) => {
      let isSettled = false;
      let timeoutTimer: NodeJS.Timeout | null = null;
      let req: http.ClientRequest | null = null;

      const cleanup = () => {
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
          timeoutTimer = null;
        }
        if (options?.signal) {
          options.signal.removeEventListener('abort', onAbort);
        }
      };

      const fail = (err: RendererError) => {
        if (!isSettled) {
          isSettled = true;
          cleanup();
          req?.destroy();
          reject(err);
        }
      };

      const onAbort = () => {
        fail(
          new RendererError('ASSET_TIMEOUT', `Asset fetch aborted or timed out for "${urlStr}".`),
        );
      };

      if (options?.signal) {
        if (options.signal.aborted) {
          onAbort();
          return;
        }
        options.signal.addEventListener('abort', onAbort);
      }

      timeoutTimer = setTimeout(() => {
        fail(
          new RendererError(
            'ASSET_TIMEOUT',
            `Asset fetch timed out after ${timeoutMs}ms for "${urlStr}".`,
          ),
        );
      }, timeoutMs);

      const customLookup: http.RequestOptions['lookup'] = (_hostname, _opts, cb) => {
        // Pin connection strictly to approved address
        cb(null, approvedAddress.address, approvedAddress.family);
      };

      const reqOpts: https.RequestOptions = {
        hostname: parsed.hostname,
        port,
        path: `${parsed.pathname}${parsed.search}`,
        method: 'GET',
        lookup: customLookup,
        headers: {
          'User-Agent': 'BangumiAgentKit-Renderer/1.0',
          Accept: 'image/png,image/jpeg,image/webp',
          Host: parsed.host,
          ...options?.headers,
        },
        servername: parsed.hostname, // TLS SNI hostname
      };

      req = (requestModule as typeof https).request(reqOpts, (res) => {
        const rawHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) {
          if (typeof v === 'string') {
            rawHeaders[k.toLowerCase()] = v;
          } else if (Array.isArray(v)) {
            rawHeaders[k.toLowerCase()] = v.join(', ');
          }
        }

        const statusCode = res.statusCode || 500;

        // Redirects handled by caller loop, resolve headers and response body
        if (statusCode >= 300 && statusCode < 400) {
          if (!isSettled) {
            isSettled = true;
            cleanup();
            res.destroy();
            resolve({
              status: statusCode,
              headers: rawHeaders,
              buffer: Buffer.alloc(0),
              url: urlStr,
            });
          }
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          fail(
            new RendererError(
              'ASSET_FETCH_FAILED',
              `HTTP ${statusCode} fetching image from "${urlStr}".`,
            ),
          );
          return;
        }

        const headerVal = rawHeaders['content-type'];
        const rawContentType = (headerVal || '').toLowerCase().split(';')[0]?.trim() || '';
        if (rawContentType.includes('svg') || urlStr.toLowerCase().endsWith('.svg')) {
          fail(new RendererError('ASSET_INVALID_IMAGE', `SVG images are rejected for safety.`));
          return;
        }
        if (!ALLOWED_CONTENT_TYPES.has(rawContentType)) {
          fail(
            new RendererError(
              'ASSET_INVALID_IMAGE',
              `Content-Type "${rawContentType}" is not allowed. Expected image/png, image/jpeg, or image/webp.`,
            ),
          );
          return;
        }

        const chunks: Buffer[] = [];
        let loadedBytes = 0;

        res.on('data', (chunk: Buffer) => {
          loadedBytes += chunk.length;
          if (loadedBytes > maxBytes) {
            fail(new RendererError('ASSET_TOO_LARGE', `Asset exceeded maximum size limit.`));
            return;
          }
          chunks.push(chunk);
        });

        res.on('end', () => {
          if (!isSettled) {
            isSettled = true;
            cleanup();
            resolve({
              status: statusCode,
              headers: rawHeaders,
              buffer: Buffer.concat(chunks),
              url: urlStr,
            });
          }
        });

        res.on('error', (err) => {
          fail(
            new RendererError(
              'ASSET_FETCH_FAILED',
              `Stream error from "${urlStr}": ${String(err)}`,
            ),
          );
        });
      });

      req.on('error', (err) => {
        fail(
          new RendererError(
            'ASSET_FETCH_FAILED',
            `Socket request error for "${urlStr}": ${String(err)}`,
          ),
        );
      });

      req.end();
    });
  }
}
