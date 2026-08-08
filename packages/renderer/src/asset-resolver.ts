import dns from 'node:dns/promises';
import net from 'node:net';
import { URL } from 'node:url';
import sharp from 'sharp';
import { RendererError } from './errors.js';

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

    if (hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.localhost')) {
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

export async function validateDnsAndIp(hostname: string): Promise<string[]> {
  if (net.isIP(hostname)) {
    if (isIpAddressBlocked(hostname)) {
      throw new RendererError('ASSET_URL_BLOCKED', `Blocked IP address "${hostname}".`);
    }
    return [hostname];
  }

  try {
    const records = await dns.lookup(hostname, { all: true });
    if (!records || records.length === 0) {
      throw new RendererError('ASSET_FETCH_FAILED', `DNS resolution returned empty for "${hostname}".`);
    }

    const ips = records.map((r) => r.address);
    for (const ip of ips) {
      if (isIpAddressBlocked(ip)) {
        throw new RendererError('ASSET_URL_BLOCKED', `DNS resolved to blocked IP "${ip}" for host "${hostname}".`);
      }
    }
    return ips;
  } catch (err) {
    if (err instanceof RendererError) throw err;
    throw new RendererError('ASSET_FETCH_FAILED', `DNS lookup failed for "${hostname}": ${String(err)}`);
  }
}

const DEFAULT_PLACEHOLDER_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

export async function fetchAndProcessImage(
  urlStr: string,
  fetchFn: typeof fetch = fetch,
  maxRedirects = 3,
): Promise<Buffer> {
  let currentUrl = urlStr;
  let response: Response | null = null;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (!isUrlAllowed(currentUrl)) {
      throw new RendererError('ASSET_URL_BLOCKED', `URL "${currentUrl}" violates SSRF policy.`);
    }

    const parsed = new URL(currentUrl);
    await validateDnsAndIp(parsed.hostname);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      response = await fetchFn(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          UserAent: 'BangumiAgentKit-Renderer/1.0',
          Accept: 'image/png,image/jpeg,image/webp,*/*',
        },
      });
    } catch (err) {
      clearTimeout(timeout);
      throw new RendererError('ASSET_FETCH_FAILED', `Fetch failed for "${currentUrl}": ${String(err)}`);
    } finally {
      clearTimeout(timeout);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        throw new RendererError('ASSET_FETCH_FAILED', `Redirect response missing Location header from "${currentUrl}".`);
      }
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (!response.ok) {
      throw new RendererError('ASSET_FETCH_FAILED', `HTTP ${response.status} when fetching image from "${currentUrl}".`);
    }

    break;
  }

  if (!response || !response.ok) {
    throw new RendererError('ASSET_FETCH_FAILED', `Failed to obtain image after redirects.`);
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('svg') || currentUrl.toLowerCase().endsWith('.svg')) {
    throw new RendererError('ASSET_INVALID_IMAGE', `SVG images are rejected for safety.`);
  }

  const MAX_BYTES = 5 * 1024 * 1024; // 5MB
  let rawBuffer: Buffer;

  if (response.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loadedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        loadedBytes += value.length;
        if (loadedBytes > MAX_BYTES) {
          controllerAbort(reader);
          throw new RendererError('ASSET_TOO_LARGE', `Asset exceeded maximum 5MB size limit.`);
        }
        chunks.push(value);
      }
    }
    rawBuffer = Buffer.concat(chunks);
  } else {
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_BYTES) {
      throw new RendererError('ASSET_TOO_LARGE', `Asset exceeded maximum 5MB size limit.`);
    }
    rawBuffer = Buffer.from(arrayBuffer);
  }

  try {
    const image = sharp(rawBuffer);
    const metadata = await image.metadata();

    if (!metadata.format || metadata.format === 'svg') {
      throw new RendererError('ASSET_INVALID_IMAGE', `Invalid or unsupported image format "${metadata.format}".`);
    }

    const width = metadata.width || 0;
    const height = metadata.height || 0;
    if (width > 4096 || height > 4096 || width * height > 16000000) {
      throw new RendererError('ASSET_TOO_LARGE', `Image dimensions (${width}x${height}) exceed maximum allowed size.`);
    }

    const processedBuffer = await image
      .rotate() // auto orient EXIF
      .resize({ width: 800, height: 1200, fit: 'inside', withoutEnlargement: true })
      .toFormat('png')
      .toBuffer();

    return processedBuffer;
  } catch (err) {
    if (err instanceof RendererError) throw err;
    throw new RendererError('ASSET_INVALID_IMAGE', `Sharp image processing failed: ${String(err)}`);
  }
}

function controllerAbort(reader: ReadableStreamDefaultReader<Uint8Array>) {
  try {
    reader.cancel();
  } catch {
    // ignore
  }
}

export class AssetResolver {
  constructor(private fetchFn: typeof fetch = fetch) {}

  async resolveAsset(url?: string): Promise<ResolvedAsset> {
    if (!url) {
      return { dataUrl: DEFAULT_PLACEHOLDER_DATA_URL };
    }

    if (url.startsWith('data:image/')) {
      if (url.includes('image/svg+xml')) {
        return {
          dataUrl: DEFAULT_PLACEHOLDER_DATA_URL,
          warning: { code: 'ASSET_INVALID_IMAGE', message: 'SVG data URLs rejected for safety', url },
        };
      }
      return { dataUrl: url };
    }

    try {
      const pngBuffer = await fetchAndProcessImage(url, this.fetchFn);
      const base64 = pngBuffer.toString('base64');
      return { dataUrl: `data:image/png;base64,${base64}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = err instanceof RendererError ? err.code : 'ASSET_FETCH_FAILED';
      return {
        dataUrl: DEFAULT_PLACEHOLDER_DATA_URL,
        warning: { code, message: msg, url },
      };
    }
  }
}
