import { describe, it, expect } from 'vitest';
import {
  isUrlAllowed,
  isIpAddressBlocked,
  fetchAndProcessImage,
  AssetResolver,
} from '@bangumi-agent-kit/renderer';

describe('PR-5 SSRF Security & Asset Resolver (R09 - R21)', () => {
  it('R10: localhost asset blocked by URL policy', () => {
    expect(isUrlAllowed('http://localhost/image.png')).toBe(false);
    expect(isUrlAllowed('http://localhost:8080/image.png')).toBe(false);
    expect(isUrlAllowed('https://test.localhost/image.png')).toBe(false);
  });

  it('R11: 127.0.0.1 blocked by IP policy', () => {
    expect(isUrlAllowed('http://127.0.0.1/cover.jpg')).toBe(false);
    expect(isIpAddressBlocked('127.0.0.1')).toBe(true);
    expect(isIpAddressBlocked('127.0.0.2')).toBe(true);
  });

  it('R12: private IPv4 ranges blocked', () => {
    expect(isIpAddressBlocked('10.0.0.1')).toBe(true);
    expect(isIpAddressBlocked('10.255.255.255')).toBe(true);
    expect(isIpAddressBlocked('172.16.0.1')).toBe(true);
    expect(isIpAddressBlocked('172.31.255.255')).toBe(true);
    expect(isIpAddressBlocked('192.168.1.1')).toBe(true);
    expect(isIpAddressBlocked('100.64.0.1')).toBe(true); // CGNAT
    expect(isIpAddressBlocked('0.0.0.0')).toBe(true);

    // Public IPs should pass
    expect(isIpAddressBlocked('1.1.1.1')).toBe(false);
    expect(isIpAddressBlocked('8.8.8.8')).toBe(false);
  });

  it('R13: IPv6 loopback blocked', () => {
    expect(isIpAddressBlocked('::1')).toBe(true);
    expect(isIpAddressBlocked('::')).toBe(true);
    expect(isIpAddressBlocked('::ffff:127.0.0.1')).toBe(true);
  });

  it('R14: IPv6 ULA & Link Local blocked', () => {
    expect(isIpAddressBlocked('fc00::1')).toBe(true);
    expect(isIpAddressBlocked('fd00::1234')).toBe(true);
    expect(isIpAddressBlocked('fe80::1')).toBe(true);
  });

  it('R15: Cloud metadata endpoints blocked', () => {
    expect(isUrlAllowed('http://169.254.169.254/latest/meta-data/')).toBe(false);
    expect(isUrlAllowed('http://metadata.google.internal/computeMetadata/v1/')).toBe(false);
  });

  it('R16: Public -> Private redirect blocked', async () => {
    const mockFetch = async (input: string | URL, _init?: unknown) => {
      const urlStr = input.toString();
      if (urlStr === 'http://example.com/redirect-to-private') {
        return new Response(null, {
          status: 302,
          headers: { Location: 'http://127.0.0.1/secret.png' },
        });
      }
      return new Response('ok', { status: 200 });
    };

    await expect(
      fetchAndProcessImage('http://example.com/redirect-to-private', mockFetch as typeof fetch),
    ).rejects.toThrowError(/ASSET_URL_BLOCKED/);
  });

  it('R17 & R18: Non-image content or spoofed content-type rejected by Sharp', async () => {
    const mockFetch = async () => {
      return new Response('<html><body>Fake Image</body></html>', {
        status: 200,
        headers: { 'Content-Type': 'image/png' }, // Spoofed header
      });
    };

    await expect(
      fetchAndProcessImage('http://example.com/spoofed.png', mockFetch as typeof fetch),
    ).rejects.toThrowError(/ASSET_INVALID_IMAGE/);
  });

  it('R19: Oversized asset rejected', async () => {
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
    const mockFetch = async () => {
      return new Response(largeBuffer, {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      });
    };

    await expect(
      fetchAndProcessImage('http://example.com/huge.png', mockFetch as typeof fetch),
    ).rejects.toThrowError(/ASSET_TOO_LARGE/);
  });

  it('R20: SVG image rejected', async () => {
    const svgStr = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="10"/></svg>';
    const mockFetch = async () => {
      return new Response(svgStr, {
        status: 200,
        headers: { 'Content-Type': 'image/svg+xml' },
      });
    };

    await expect(
      fetchAndProcessImage('http://example.com/vector.svg', mockFetch as typeof fetch),
    ).rejects.toThrowError(/ASSET_INVALID_IMAGE/);
  });

  it('R21: Broken image fetch falls back to placeholder data URL with warning', async () => {
    const mockFetch = async () => {
      return new Response(null, { status: 404 });
    };

    const resolver = new AssetResolver(mockFetch as typeof fetch);
    const resolved = await resolver.resolveAsset('http://example.com/404.png');

    expect(resolved.dataUrl).toContain('data:image/png;base64,');
    expect(resolved.warning).toBeDefined();
    expect(resolved.warning?.code).toBe('ASSET_FETCH_FAILED');
  });
});
