#!/usr/bin/env node

/**
 * PR-7A2 read-only probe for already-known public GET surfaces.
 *
 * This script deliberately sends no cookies, bearer tokens, or mutation
 * requests. It is a research aid, not a runtime dependency.
 */

const baseUrl = process.env.PR7A2_BASE_URL ?? 'https://next.bgm.tv';
const paths = process.argv.slice(2);
const targets = paths.length > 0 ? paths : ['/p1/openapi.json', '/p1/calendar'];
const userAgent = 'BangumiAgentKit-PR7A2-Research/1.0 (+read-only; contact unavailable)';
const delayMs = 350;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

for (const path of targets) {
  const url = new URL(path, baseUrl).toString();
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'user-agent': userAgent, accept: 'application/json' },
      redirect: 'manual',
    });
    const body = await response.text();
    let shape = 'non-json';
    try {
      const parsed = JSON.parse(body);
      if (Array.isArray(parsed)) shape = `array(${parsed.length})`;
      else if (parsed && typeof parsed === 'object')
        shape = `object(${Object.keys(parsed).slice(0, 12).join(',')})`;
      else shape = typeof parsed;
    } catch {
      // The status/content type and byte length are sufficient for this probe.
    }
    console.log(
      JSON.stringify({
        url,
        status: response.status,
        contentType: response.headers.get('content-type'),
        bytes: Buffer.byteLength(body),
        shape,
      }),
    );
  } catch (error) {
    console.log(
      JSON.stringify({ url, error: error instanceof Error ? error.message : String(error) }),
    );
  }
  await sleep(delayMs);
}
