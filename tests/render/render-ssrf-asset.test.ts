import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import {
  isUrlAllowed,
  isIpAddressBlocked,
  fetchAndProcessImage,
  AssetResolver,
  AssetHttpTransport,
  AssetNetworkResolver,
  NodeAssetHttpTransport,
  createPinnedLookup,
  RendererError,
  sharp,
} from '../../packages/renderer/src/internal/index.js';

let VALID_PNG_BUFFER: Buffer;

beforeAll(async () => {
  VALID_PNG_BUFFER = await sharp({
    create: {
      width: 10,
      height: 10,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
});

describe('PR-5 SSRF Security & Asset Resolver (R10 - R21)', () => {
  it('B0: pinned lookup returns the scalar callback contract by default', () => {
    const lookup = createPinnedLookup({ address: '93.184.216.34', family: 4 });
    const callback = vi.fn();

    lookup('cover.example', { all: false }, callback);

    expect(callback).toHaveBeenCalledWith(null, '93.184.216.34', 4);
  });

  it('B0: pinned lookup returns an address array for all:true', () => {
    const lookup = createPinnedLookup({ address: '2001:db8::20', family: 6 });
    const callback = vi.fn();

    lookup('cover.example', { all: true }, callback);

    expect(callback).toHaveBeenCalledWith(null, [{ address: '2001:db8::20', family: 6 }]);
  });

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
    const mockResolver: AssetNetworkResolver = {
      async resolve(hostname: string) {
        if (hostname === '127.0.0.1') {
          throw new RendererError('ASSET_URL_BLOCKED', 'Blocked IP address "127.0.0.1".');
        }
        return [{ address: '93.184.216.34', family: 4 }];
      },
    };

    const mockTransport: AssetHttpTransport = {
      async request(url, _approved) {
        if (url === 'http://example.com/redirect-to-private') {
          return {
            status: 302,
            headers: { location: 'http://127.0.0.1/secret.png' } as Record<string, string>,
            buffer: Buffer.alloc(0),
            url,
          };
        }
        return {
          status: 200,
          headers: { 'content-type': 'image/png' } as Record<string, string>,
          buffer: VALID_PNG_BUFFER,
          url,
        };
      },
    };

    await expect(
      fetchAndProcessImage('http://example.com/redirect-to-private', mockTransport, mockResolver),
    ).rejects.toThrowError(/ASSET_URL_BLOCKED/);
  });

  it('DNS Rebinding Regression: Transport connects ONLY to approved IP', async () => {
    let connectedAddress: string | null = null;

    const mockResolver: AssetNetworkResolver = {
      async resolve(_hostname: string) {
        // Validation lookup returns public IP 93.184.216.34
        return [{ address: '93.184.216.34', family: 4 }];
      },
    };

    const mockTransport: AssetHttpTransport = {
      async request(url, approvedAddress) {
        connectedAddress = approvedAddress.address;
        return {
          status: 200,
          headers: { 'content-type': 'image/png' } as Record<string, string>,
          buffer: VALID_PNG_BUFFER,
          url,
        };
      },
    };

    const buffer = await fetchAndProcessImage(
      'http://evil-rebind.test/pic.png',
      mockTransport,
      mockResolver,
    );
    expect(buffer).toBeDefined();
    // Prove that transport connected ONLY to the approved address passed from resolver
    expect(connectedAddress).toBe('93.184.216.34');
  });

  it('Redirect Rebinding: Redirect target gets fresh DNS resolution and pinned address', async () => {
    const resolvedHosts: string[] = [];
    const connectedAddresses: string[] = [];

    const mockResolver: AssetNetworkResolver = {
      async resolve(hostname: string) {
        resolvedHosts.push(hostname);
        if (hostname === 'redirect-target.test') {
          return [{ address: '198.51.100.20', family: 4 }];
        }
        return [{ address: '93.184.216.34', family: 4 }];
      },
    };

    const mockTransport: AssetHttpTransport = {
      async request(url, approvedAddress) {
        connectedAddresses.push(approvedAddress.address);
        if (url === 'http://initial.test/image.png') {
          return {
            status: 302,
            headers: { location: 'http://redirect-target.test/final.png' } as Record<
              string,
              string
            >,
            buffer: Buffer.alloc(0),
            url,
          };
        }
        return {
          status: 200,
          headers: { 'content-type': 'image/png' } as Record<string, string>,
          buffer: VALID_PNG_BUFFER,
          url,
        };
      },
    };

    const buffer = await fetchAndProcessImage(
      'http://initial.test/image.png',
      mockTransport,
      mockResolver,
    );
    expect(buffer).toBeDefined();
    expect(resolvedHosts).toEqual(['initial.test', 'redirect-target.test']);
    expect(connectedAddresses).toEqual(['93.184.216.34', '198.51.100.20']);
  });

  it('R17 & R18: Non-image content or spoofed content-type rejected by Sharp', async () => {
    const mockTransport: AssetHttpTransport = {
      async request(url) {
        return {
          status: 200,
          headers: { 'content-type': 'image/png' } as Record<string, string>, // Spoofed header
          buffer: Buffer.from('<html><body>Fake Image</body></html>'),
          url,
        };
      },
    };

    await expect(
      fetchAndProcessImage('http://example.com/spoofed.png', mockTransport),
    ).rejects.toThrowError(/ASSET_INVALID_IMAGE/);
  });

  it('Content-Type Allowlist: Invalid HTTP Content-Type rejected before decode', async () => {
    const mockTransport: AssetHttpTransport = {
      async request(url) {
        return {
          status: 200,
          headers: { 'content-type': 'text/html' } as Record<string, string>,
          buffer: VALID_PNG_BUFFER, // Valid PNG bytes, but wrong header
          url,
        };
      },
    };

    await expect(
      fetchAndProcessImage('http://example.com/page.png', mockTransport),
    ).rejects.toThrowError(/ASSET_INVALID_IMAGE/);
  });

  it('R19: Oversized asset rejected', async () => {
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
    const mockTransport: AssetHttpTransport = {
      async request(url) {
        return {
          status: 200,
          headers: { 'content-type': 'image/png' } as Record<string, string>,
          buffer: largeBuffer,
          url,
        };
      },
    };

    await expect(
      fetchAndProcessImage('http://example.com/huge.png', mockTransport),
    ).rejects.toThrowError(/ASSET_TOO_LARGE/);
  });

  it('R20: SVG image rejected', async () => {
    const svgStr = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="10"/></svg>';
    const mockTransport: AssetHttpTransport = {
      async request(url) {
        return {
          status: 200,
          headers: { 'content-type': 'image/svg+xml' } as Record<string, string>,
          buffer: Buffer.from(svgStr),
          url,
        };
      },
    };

    await expect(
      fetchAndProcessImage('http://example.com/vector.svg', mockTransport),
    ).rejects.toThrowError(/ASSET_INVALID_IMAGE/);
  });

  it('Reject Caller-Supplied Data URLs: data: URLs return placeholder + warning', async () => {
    const resolver = new AssetResolver();
    const resolved = await resolver.resolveAsset(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    );

    expect(resolved.dataUrl).toContain('data:image/png;base64,');
    expect(resolved.warning).toBeDefined();
    expect(resolved.warning?.code).toBe('ASSET_URL_BLOCKED');
  });

  it('R21: Broken image fetch falls back to placeholder data URL with warning', async () => {
    const mockTransport: AssetHttpTransport = {
      async request(url) {
        return {
          status: 404,
          headers: {} as Record<string, string>,
          buffer: Buffer.alloc(0),
          url,
        };
      },
    };

    const resolver = new AssetResolver(mockTransport);
    const resolved = await resolver.resolveAsset('http://example.com/404.png');

    expect(resolved.dataUrl).toContain('data:image/png;base64,');
    expect(resolved.warning).toBeDefined();
    expect(resolved.warning?.code).toBe('ASSET_FETCH_FAILED');
  });

  it('Pre-aborted signal regression: request rejects with ASSET_TIMEOUT without ReferenceError', async () => {
    const transport = new NodeAssetHttpTransport();
    const controller = new AbortController();
    controller.abort();

    await expect(
      transport.request(
        'http://example.test/a.png',
        { address: '93.184.216.34', family: 4 },
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({
      code: 'ASSET_TIMEOUT',
    });
  });

  it('Redirect response body termination: 302 response with infinite body stream resolves immediately', async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(302, { Location: 'http://example.test/target.png' });
      const interval = setInterval(() => {
        res.write('never-ending body data...');
      }, 10);
      res.on('close', () => {
        clearInterval(interval);
      });
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;

    const transport = new NodeAssetHttpTransport();
    try {
      const res = await transport.request(`http://127.0.0.1:${port}/redirect`, {
        address: '127.0.0.1',
        family: 4,
      });

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('http://example.test/target.png');
      expect(res.buffer.length).toBe(0);
    } finally {
      server.close();
    }
  });

  it('Real Asset Body Timeout: stalls during body streaming returns ASSET_TIMEOUT', async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.write(Buffer.from([0x89, 0x50, 0x4e, 0x47])); // Write 4 bytes header signature
      // Do NOT end response, stall body delivery
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;

    const transport = new NodeAssetHttpTransport();
    const startTime = Date.now();
    try {
      await expect(
        transport.request(
          `http://127.0.0.1:${port}/stalled.png`,
          { address: '127.0.0.1', family: 4 },
          { timeoutMs: 150 },
        ),
      ).rejects.toMatchObject({
        code: 'ASSET_TIMEOUT',
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000);
    } finally {
      server.close();
    }
  });
});
