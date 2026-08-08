import { URL } from 'node:url';
import net from 'node:net';
import sharp from 'sharp';
import { RendererError } from './errors.js';
import { RendererLruCache } from './lru-cache.js';
import {
  AssetHttpTransport,
  AssetNetworkResolver,
  DefaultAssetNetworkResolver,
  NodeAssetHttpTransport,
} from './asset-transport.js';

export interface RenderWarning {
  code: string;
  message: string;
  url?: string;
}

export interface ResolvedAsset {
  dataUrl: string;
  warning?: RenderWarning;
}

const DENIED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '169.254.169.254',
  'metadata.google.internal',
]);

export function isIpv4Blocked(ip: string): boolean {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true;
  }
  const [a, b] = parts as [number, number, number, number];

  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 Carrier-grade NAT
  if (a === 127) return true; // 127.0.0.0/8 Loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 Link-local / Cloud Metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 Private
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 Private
  if (a >= 224) return true; // 224.0.0.0/4 Multicast & Reserved

  return false;
}

export function isIpv6Blocked(ip: string): boolean {
  const normalized = ip.toLowerCase();

  if (normalized === '::' || normalized === '::1') return true;

  // IPv4-mapped IPv6: ::ffff:127.0.0.1
  if (normalized.startsWith('::ffff:')) {
    const ipv4Part = normalized.slice(7);
    if (net.isIPv4(ipv4Part)) {
      return isIpv4Blocked(ipv4Part);
    }
    return true;
  }

  // fc00::/7 Unique Local
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

  // fe80::/10 Link Local
  if (
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  ) {
    return true;
  }

  return false;
}

export function isIpAddressBlocked(ip: string): boolean {
  if (net.isIPv4(ip)) {
    return isIpv4Blocked(ip);
  }
  if (net.isIPv6(ip)) {
    return isIpv6Blocked(ip);
  }
  return true;
}

export function isUrlAllowed(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    if (parsed.username || parsed.password) {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    if (DENIED_HOSTNAMES.has(hostname)) {
      return false;
    }

    if (
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.localhost')
    ) {
      return false;
    }

    if (net.isIP(hostname)) {
      if (isIpAddressBlocked(hostname)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

export const DEFAULT_PLACEHOLDER_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

export async function fetchAndProcessImage(
  urlStr: string,
  transport: AssetHttpTransport = new NodeAssetHttpTransport(),
  resolver: AssetNetworkResolver = new DefaultAssetNetworkResolver(),
  maxRedirects = 3,
  signal?: AbortSignal,
): Promise<Buffer> {
  let currentUrl = urlStr;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (!isUrlAllowed(currentUrl)) {
      throw new RendererError('ASSET_URL_BLOCKED', `URL "${currentUrl}" violates SSRF policy.`);
    }

    const parsed = new URL(currentUrl);
    const approvedAddresses = await resolver.resolve(parsed.hostname);

    if (!approvedAddresses || approvedAddresses.length === 0) {
      throw new RendererError(
        'ASSET_FETCH_FAILED',
        `No valid IP address for "${parsed.hostname}".`,
      );
    }

    const approvedAddress = approvedAddresses[0];
    if (!approvedAddress) {
      throw new RendererError(
        'ASSET_FETCH_FAILED',
        `No valid IP address for "${parsed.hostname}".`,
      );
    }
    const res = await transport.request(currentUrl, approvedAddress, { signal, timeoutMs: 5000 });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers['location'];
      if (!location) {
        throw new RendererError(
          'ASSET_FETCH_FAILED',
          `Redirect response missing Location header from "${currentUrl}".`,
        );
      }
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (res.status < 200 || res.status >= 300) {
      throw new RendererError(
        'ASSET_FETCH_FAILED',
        `HTTP ${res.status} when fetching image from "${currentUrl}".`,
      );
    }

    const headerContentType =
      (res.headers['content-type'] || '').toLowerCase().split(';')[0]?.trim() || '';
    if (headerContentType.includes('svg') || currentUrl.toLowerCase().endsWith('.svg')) {
      throw new RendererError('ASSET_INVALID_IMAGE', `SVG images are rejected for safety.`);
    }
    const ALLOWED_CONTENT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
    if (headerContentType && !ALLOWED_CONTENT_TYPES.has(headerContentType)) {
      throw new RendererError(
        'ASSET_INVALID_IMAGE',
        `Content-Type "${headerContentType}" is not allowed. Expected image/png, image/jpeg, or image/webp.`,
      );
    }

    const MAX_BYTES = 5 * 1024 * 1024; // 5MB
    if (res.buffer.length > MAX_BYTES) {
      throw new RendererError('ASSET_TOO_LARGE', `Asset exceeded maximum 5MB size limit.`);
    }

    // Sharp validation and processing
    try {
      const image = sharp(res.buffer);
      const metadata = await image.metadata();

      if (!metadata.format || metadata.format === 'svg') {
        throw new RendererError(
          'ASSET_INVALID_IMAGE',
          `Invalid or unsupported image format "${metadata.format}".`,
        );
      }

      const width = metadata.width || 0;
      const height = metadata.height || 0;
      if (width > 4096 || height > 4096 || width * height > 16000000) {
        throw new RendererError(
          'ASSET_TOO_LARGE',
          `Image dimensions (${width}x${height}) exceed maximum allowed size.`,
        );
      }

      const processedBuffer = await image
        .rotate()
        .resize({ width: 800, height: 1200, fit: 'inside', withoutEnlargement: true })
        .toFormat('png')
        .toBuffer();

      return processedBuffer;
    } catch (err) {
      if (err instanceof RendererError) throw err;
      throw new RendererError(
        'ASSET_INVALID_IMAGE',
        `Sharp image processing failed: ${String(err)}`,
      );
    }
  }

  throw new RendererError('ASSET_FETCH_FAILED', `Exceeded maximum redirects (${maxRedirects}).`);
}

export class AssetResolver {
  private cache = new RendererLruCache<ResolvedAsset>(100);

  constructor(
    private transport: AssetHttpTransport = new NodeAssetHttpTransport(),
    private resolver: AssetNetworkResolver = new DefaultAssetNetworkResolver(),
  ) {}

  async resolveAsset(url?: string, signal?: AbortSignal): Promise<ResolvedAsset> {
    if (!url) {
      return { dataUrl: DEFAULT_PLACEHOLDER_DATA_URL };
    }

    // Reject caller-supplied data:, blob:, file:, etc.
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('file:')) {
      return {
        dataUrl: DEFAULT_PLACEHOLDER_DATA_URL,
        warning: {
          code: 'ASSET_URL_BLOCKED',
          message: 'Caller-supplied data/blob/file URLs are rejected for security',
          url,
        },
      };
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return {
        dataUrl: DEFAULT_PLACEHOLDER_DATA_URL,
        warning: {
          code: 'ASSET_URL_BLOCKED',
          message: 'Invalid or unsupported URL scheme',
          url,
        },
      };
    }

    const cached = this.cache.get(url);
    if (cached) {
      return cached;
    }

    try {
      const pngBuffer = await fetchAndProcessImage(url, this.transport, this.resolver, 3, signal);
      const base64 = pngBuffer.toString('base64');
      const result: ResolvedAsset = { dataUrl: `data:image/png;base64,${base64}` };
      this.cache.set(url, result);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = err instanceof RendererError ? err.code : 'ASSET_FETCH_FAILED';
      const result: ResolvedAsset = {
        dataUrl: DEFAULT_PLACEHOLDER_DATA_URL,
        warning: { code, message: msg, url },
      };
      // Don't cache transient failures
      return result;
    }
  }
}
