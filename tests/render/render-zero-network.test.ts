import http from 'node:http';
import { AddressInfo } from 'node:net';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BrowserPool } from '../../packages/renderer/src/internal/index.js';

describe('R09: True Browser Zero-Network Isolation', () => {
  let server: http.Server;
  let port: number;
  let requestCount = 0;
  let pool: BrowserPool;

  beforeAll(async () => {
    pool = new BrowserPool({ maxConcurrency: 1 });
    server = http.createServer((_req, res) => {
      requestCount++;
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end('fake image bytes');
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo;
        port = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await pool.close();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('R09: Playwright route abort prevents network request from reaching local server', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <div data-render-root style="width: 400px; height: 300px; background: #222;">
            <img src="http://127.0.0.1:${port}/probe.png" alt="probe" />
            <h1>Zero Network Test</h1>
          </div>
        </body>
      </html>
    `;

    const buffer = await pool.renderHtmlToBuffer(html);
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(1000);

    // Give any potential async network request time to register
    await new Promise((r) => setTimeout(r, 100));

    expect(requestCount).toBe(0);
  });
});
