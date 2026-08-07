import { URL } from 'node:url';

const DENIED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '169.254.169.254', // AWS/GCP/Azure Metadata
  'metadata.google.internal',
]);

const PRIVATE_IP_REGEX = /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|127\.)/;

export function isUrlAllowed(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    if (DENIED_HOSTS.has(hostname)) {
      return false;
    }

    if (PRIVATE_IP_REGEX.test(hostname)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function fetchAndVerifyImage(
  url: string,
  fetchFn: typeof fetch = fetch
): Promise<{ buffer: Buffer; contentType: string }> {
  if (!isUrlAllowed(url)) {
    throw new Error(`SSRF Blocked: Image URL "${url}" is not allowed.`);
  }

  const res = await fetchFn(url, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`Failed to fetch image [${res.status}]: ${res.statusText}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    throw new Error(`Invalid content-type: "${contentType}". Expected image/*`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  if (buffer.length > MAX_SIZE) {
    throw new Error(`Image size ${buffer.length} bytes exceeds 10MB limit.`);
  }

  return { buffer, contentType };
}
