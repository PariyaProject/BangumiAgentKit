#!/usr/bin/env node

/**
 * PR-7C C0 read-only probe for official Bangumi subject search and browse.
 *
 * The script never sends cookies, bearer tokens, or mutation requests. It is
 * intentionally not wired into CI: live probing is opt-in and requires an
 * explicit User-Agent that identifies the caller, as requested by Bangumi's
 * official API guidance.
 */

import { writeFile } from 'node:fs/promises';

const DEFAULT_BASE_URL = process.env.PR7C_BASE_URL ?? 'https://api.bgm.tv';
const DEFAULT_DELAY_MS = 1000;
const DEFAULT_TIMEOUT_MS = 15000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseArgs(argv) {
  const args = {
    baseUrl: DEFAULT_BASE_URL,
    delayMs: DEFAULT_DELAY_MS,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    live: false,
    output: undefined,
    userAgent: process.env.BANGUMI_USER_AGENT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--live') {
      args.live = true;
    } else if (arg === '--base-url') {
      args.baseUrl = argv[++index];
    } else if (arg === '--delay-ms') {
      args.delayMs = Number(argv[++index]);
    } else if (arg === '--timeout-ms') {
      args.timeoutMs = Number(argv[++index]);
    } else if (arg === '--output') {
      args.output = argv[++index];
    } else if (arg === '--user-agent') {
      args.userAgent = argv[++index];
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isInteger(args.delayMs) || args.delayMs < 0) {
    throw new Error('--delay-ms must be a non-negative integer');
  }
  if (!Number.isInteger(args.timeoutMs) || args.timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive integer');
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/research/pr7c/probe-subject-search.mjs
  node scripts/research/pr7c/probe-subject-search.mjs --live \\
    --user-agent 'developer/App (https://example.invalid/project)'

Without --live the script only prints the planned, read-only cases.
With --live it sends sequential requests to the official API, waiting
--delay-ms between requests. Use --output path.json to save the report.

Options:
  --live                 Opt in to network requests (default: dry plan)
  --base-url URL         API base URL (default: ${DEFAULT_BASE_URL})
  --user-agent VALUE     Required for --live; also accepts BANGUMI_USER_AGENT
  --delay-ms N           Delay between requests (default: ${DEFAULT_DELAY_MS})
  --timeout-ms N         Per-request timeout (default: ${DEFAULT_TIMEOUT_MS})
  --output PATH          Write JSON report to PATH instead of stdout
`);
}

function searchCase(id, body, query = {}, assertions = [], note = '') {
  return {
    id,
    family: 'search',
    method: 'POST',
    path: '/v0/search/subjects',
    query,
    body,
    assertions,
    note,
  };
}

function browseCase(id, query, assertions = [], note = '') {
  return {
    id,
    family: 'browse',
    method: 'GET',
    path: '/v0/subjects',
    query,
    assertions,
    note,
  };
}

function buildCases() {
  return [
    searchCase(
      'search-empty-keyword',
      { keyword: '' },
      {},
      [],
      'Tests whether the required keyword field accepts an empty string.',
    ),
    searchCase('search-filter-type-anime', { keyword: '', filter: { type: [2] } }, {}, [
      { kind: 'type', value: 2 },
    ]),
    searchCase(
      'search-filter-air-date',
      { keyword: '', filter: { air_date: ['>=2026-07-01', '<2026-10-01'] } },
      {},
      [{ kind: 'date-range', lower: '2026-07-01', upper: '2026-10-01' }],
    ),
    searchCase('search-filter-tag', { keyword: '', filter: { tag: ['后宫'] } }, {}, [
      { kind: 'tag', value: '后宫' },
    ]),
    searchCase('search-filter-meta-tag', { keyword: '', filter: { meta_tags: ['原创'] } }, {}, [
      { kind: 'meta-tag', value: '原创' },
    ]),
    searchCase('search-filter-rating', { keyword: '', filter: { rating: ['>=8'] } }, {}, [
      { kind: 'rating-range', lower: 8 },
    ]),
    searchCase(
      'search-filter-rating-count',
      { keyword: '', filter: { rating_count: ['>=5000'] } },
      {},
      [{ kind: 'rating-count-range', lower: 5000 }],
    ),
    searchCase('search-sort-match', { keyword: '', sort: 'match' }),
    searchCase('search-sort-heat', { keyword: '', sort: 'heat' }, {}, [
      { kind: 'sort', value: 'heat', direction: 'desc' },
    ]),
    searchCase('search-sort-rank', { keyword: '', sort: 'rank' }, {}, [
      { kind: 'sort', value: 'rank', direction: 'asc' },
    ]),
    searchCase('search-sort-score', { keyword: '', sort: 'score' }, {}, [
      { kind: 'sort', value: 'score', direction: 'desc' },
    ]),
    searchCase('search-pagination-offset-0', { keyword: '' }, { limit: 5, offset: 0 }, [
      { kind: 'pagination', requestedLimit: 5, requestedOffset: 0 },
    ]),
    searchCase('search-pagination-offset-5', { keyword: '' }, { limit: 5, offset: 5 }, [
      { kind: 'pagination', requestedLimit: 5, requestedOffset: 5 },
    ]),
    searchCase(
      'search-limit-50',
      { keyword: '' },
      { limit: 50, offset: 0 },
      [{ kind: 'pagination', requestedLimit: 50, requestedOffset: 0 }],
      'Records whether the live handler caps a request above its documented default.',
    ),
    browseCase('browse-anime', { type: 2 }),
    browseCase('browse-anime-tv', { type: 2, cat: 1 }, [{ kind: 'category', value: 1 }]),
    browseCase('browse-anime-year', { type: 2, year: 2026 }, [{ kind: 'year', value: 2026 }]),
    browseCase('browse-anime-month', { type: 2, year: 2026, month: 7 }, [
      { kind: 'year-month', year: 2026, month: 7 },
    ]),
    browseCase('browse-anime-rank', { type: 2, sort: 'rank' }, [
      { kind: 'sort', value: 'rank', direction: 'asc' },
    ]),
    browseCase('browse-anime-date', { type: 2, sort: 'date' }, [
      { kind: 'sort', value: 'date', direction: 'desc' },
    ]),
    browseCase('browse-anime-july-rank', { type: 2, year: 2026, month: 7, sort: 'rank' }, [
      { kind: 'year-month', year: 2026, month: 7 },
      { kind: 'sort', value: 'rank', direction: 'asc' },
    ]),
    browseCase('browse-pagination-offset-5', { type: 2, limit: 5, offset: 5 }, [
      { kind: 'pagination', requestedLimit: 5, requestedOffset: 5 },
    ]),
    browseCase(
      'browse-limit-50',
      { type: 2, limit: 50, offset: 0 },
      [{ kind: 'pagination', requestedLimit: 50, requestedOffset: 0 }],
      'Records whether the live handler agrees with the pinned OpenAPI maximum of 50.',
    ),
    browseCase(
      'browse-limit-100',
      { type: 2, limit: 100, offset: 0 },
      [{ kind: 'pagination', requestedLimit: 100, requestedOffset: 0 }],
      'Intentionally probes the source/OpenAPI maximum discrepancy; it is read-only and may return validation error.',
    ),
  ];
}

function buildUrl(baseUrl, path, query) {
  const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url;
}

function validatePagedSubject(value) {
  const issues = [];
  if (!isRecord(value)) return { valid: false, issues: ['response is not an object'] };
  for (const field of ['total', 'limit', 'offset']) {
    if (!Number.isInteger(value[field])) issues.push(`${field} is not an integer`);
  }
  if (!Array.isArray(value.data)) issues.push('data is not an array');
  for (const [index, item] of (value.data ?? []).entries()) {
    if (!isRecord(item)) {
      issues.push(`data[${index}] is not an object`);
      continue;
    }
    if (!Number.isInteger(item.id)) issues.push(`data[${index}].id is not an integer`);
    if (!Number.isInteger(item.type)) issues.push(`data[${index}].type is not an integer`);
    if (typeof item.name !== 'string') issues.push(`data[${index}].name is not a string`);
  }
  return { valid: issues.length === 0, issues };
}

function subjectRows(value) {
  return Array.isArray(value?.data) ? value.data : [];
}

function result(name, state, detail) {
  return { name, state, detail };
}

function unknown(name, detail) {
  return result(name, 'unknown', detail);
}

function everyRow(rows, name, predicate, emptyDetail) {
  if (rows.length === 0) return unknown(name, emptyDetail ?? 'page has no rows');
  const failures = rows.map((row, index) => ({ row, index })).filter(({ row }) => !predicate(row));
  return failures.length === 0
    ? result(name, 'pass', { rows: rows.length })
    : result(name, 'fail', {
        rows: rows.length,
        failingIndexes: failures.map(({ index }) => index),
      });
}

function dateAssertion(rows, name, predicate) {
  if (rows.length === 0) return unknown(name, 'page has no rows');
  const missingIndexes = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => rowDate(row) === undefined)
    .map(({ index }) => index);
  if (missingIndexes.length > 0) {
    return unknown(name, {
      reason: 'one or more response rows omit date; filter cannot be checked from this page',
      missingIndexes,
    });
  }
  return everyRow(rows, name, predicate);
}

function numericValues(rows, getter) {
  return rows.map(getter).filter((value) => typeof value === 'number' && Number.isFinite(value));
}

function checkMonotonic(rows, name, getter, direction) {
  if (rows.length === 0) return unknown(name, 'page has no rows');
  const values = rows.map(getter);
  if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    return unknown(name, 'one or more response rows lack the sortable field');
  }
  if (new Set(values).size === 1) {
    return unknown(name, {
      reason: 'all sampled sortable values are equal; response order is not proven',
      values,
    });
  }
  const violations = [];
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (
      (direction === 'asc' && current < previous) ||
      (direction === 'desc' && current > previous)
    ) {
      violations.push(index);
    }
  }
  return violations.length === 0
    ? result(name, 'pass', { values })
    : result(name, 'fail', { values, violatingIndexes: violations });
}

function ratingScore(row) {
  return row.rating?.score;
}

function ratingTotal(row) {
  return row.rating?.total;
}

function heat(row) {
  const collection = row.collection;
  if (!isRecord(collection)) return undefined;
  const values = ['wish', 'collect', 'doing', 'on_hold', 'dropped'].map((key) => collection[key]);
  return values.every((value) => typeof value === 'number')
    ? values.reduce((total, value) => total + value, 0)
    : undefined;
}

function rowDate(row) {
  return typeof row.date === 'string' ? row.date : undefined;
}

function evaluateAssertion(assertion, payload, family) {
  const rows = subjectRows(payload);
  const { kind } = assertion;

  if (kind === 'type') {
    return everyRow(rows, `type=${assertion.value}`, (row) => row.type === assertion.value);
  }
  if (kind === 'tag') {
    return everyRow(
      rows,
      `tag contains ${assertion.value}`,
      (row) => Array.isArray(row.tags) && row.tags.some((tag) => tag?.name === assertion.value),
    );
  }
  if (kind === 'meta-tag') {
    return everyRow(
      rows,
      `meta_tags contains ${assertion.value}`,
      (row) => Array.isArray(row.meta_tags) && row.meta_tags.includes(assertion.value),
    );
  }
  if (kind === 'date-range') {
    return dateAssertion(rows, 'date in requested range', (row) => {
      const date = rowDate(row);
      return date !== undefined && date >= assertion.lower && date < assertion.upper;
    });
  }
  if (kind === 'rating-range') {
    return everyRow(
      rows,
      `rating >= ${assertion.lower}`,
      (row) => ratingScore(row) >= assertion.lower,
    );
  }
  if (kind === 'rating-count-range') {
    return everyRow(
      rows,
      `rating_count >= ${assertion.lower}`,
      (row) => ratingTotal(row) >= assertion.lower,
    );
  }
  if (kind === 'year') {
    return dateAssertion(
      rows,
      `date year=${assertion.value}`,
      (row) => rowDate(row)?.slice(0, 4) === String(assertion.value),
    );
  }
  if (kind === 'year-month') {
    const prefix = `${assertion.year}-${String(assertion.month).padStart(2, '0')}-`;
    return dateAssertion(rows, `date month=${prefix}`, (row) => rowDate(row)?.startsWith(prefix));
  }
  if (kind === 'category') {
    return unknown('category response check', {
      requestedCategory: assertion.value,
      reason: 'the response carries a platform label, not the numeric cat query value',
    });
  }
  if (kind === 'sort') {
    if (assertion.value === 'match') {
      return unknown('sort=match', 'relevance ranking is not represented as a response field');
    }
    if (assertion.value === 'score') {
      return checkMonotonic(rows, 'sort=score', ratingScore, assertion.direction);
    }
    if (assertion.value === 'heat') {
      return checkMonotonic(rows, 'sort=heat', heat, assertion.direction);
    }
    if (assertion.value === 'rank') {
      return checkMonotonic(rows, 'sort=rank', (row) => row.rating?.rank, assertion.direction);
    }
    if (assertion.value === 'date') {
      return checkMonotonic(
        rows,
        'sort=date',
        (row) => (rowDate(row) ? Number(rowDate(row).replaceAll('-', '')) : undefined),
        assertion.direction,
      );
    }
  }
  if (kind === 'pagination') {
    if (!Number.isInteger(payload?.limit) || !Number.isInteger(payload?.offset)) {
      return result('pagination echo', 'fail', { reason: 'response lacks integer limit/offset' });
    }
    const withinLimit = rows.length <= payload.limit;
    const offsetEcho = payload.offset === assertion.requestedOffset;
    return withinLimit && offsetEcho
      ? result('pagination echo', 'pass', {
          requestedLimit: assertion.requestedLimit,
          observedLimit: payload.limit,
          requestedOffset: assertion.requestedOffset,
          observedOffset: payload.offset,
          returnedRows: rows.length,
        })
      : result('pagination echo', 'fail', {
          requestedLimit: assertion.requestedLimit,
          observedLimit: payload.limit,
          requestedOffset: assertion.requestedOffset,
          observedOffset: payload.offset,
          returnedRows: rows.length,
        });
  }

  return unknown(`${family}:${kind}`, 'assertion is not implemented by this probe');
}

function evaluateAssertions(probeCase, payload) {
  return probeCase.assertions.map((assertion) =>
    evaluateAssertion(assertion, payload, probeCase.family),
  );
}

function summarizeResponse(payload) {
  if (!isRecord(payload)) return undefined;
  return {
    total: payload.total,
    limit: payload.limit,
    offset: payload.offset,
    rowCount: Array.isArray(payload.data) ? payload.data.length : undefined,
    firstIds: Array.isArray(payload.data)
      ? payload.data
          .slice(0, 5)
          .map((row) => row?.id)
          .filter((id) => Number.isInteger(id))
      : [],
  };
}

async function probeCase(probeCase, options) {
  const url = buildUrl(options.baseUrl, probeCase.path, probeCase.query);
  const request = {
    method: probeCase.method,
    url: url.toString(),
    query: probeCase.query,
    body: probeCase.body,
  };
  const startedAt = new Date().toISOString();

  try {
    const response = await fetch(url, {
      method: probeCase.method,
      headers: {
        accept: 'application/json',
        ...(probeCase.method === 'POST' ? { 'content-type': 'application/json' } : {}),
        'user-agent': options.userAgent,
      },
      ...(probeCase.method === 'POST' ? { body: JSON.stringify(probeCase.body) } : {}),
      redirect: 'manual',
      signal: AbortSignal.timeout(options.timeoutMs),
    });
    const text = await response.text();
    let payload;
    let jsonError;
    try {
      payload = JSON.parse(text);
    } catch (error) {
      jsonError = error instanceof Error ? error.message : String(error);
    }
    const schema = response.ok ? validatePagedSubject(payload) : { valid: false, issues: [] };
    return {
      id: probeCase.id,
      family: probeCase.family,
      startedAt,
      request,
      status: response.status,
      contentType: response.headers.get('content-type'),
      bodyBytes: Buffer.byteLength(text),
      json: jsonError ? { valid: false, error: jsonError } : { valid: true },
      schema: { valid: schema.valid, issues: schema.issues },
      response: summarizeResponse(payload),
      assertions: response.ok && schema.valid ? evaluateAssertions(probeCase, payload) : [],
      note: probeCase.note || undefined,
      errorBodyPreview: response.ok ? undefined : text.slice(0, 500).replaceAll(/\s+/g, ' '),
    };
  } catch (error) {
    return {
      id: probeCase.id,
      family: probeCase.family,
      startedAt,
      request,
      error: error instanceof Error ? error.message : String(error),
      note: probeCase.note || undefined,
    };
  }
}

async function writeReport(report, output) {
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (output) {
    await writeFile(output, serialized, 'utf8');
  } else {
    process.stdout.write(serialized);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const cases = buildCases();
  if (!options.live) {
    await writeReport(
      {
        mode: 'dry-plan',
        generatedAt: new Date().toISOString(),
        baseUrl: options.baseUrl,
        liveRequestsSent: 0,
        cases: cases.map(({ assertions, ...probeCase }) => ({
          ...probeCase,
          assertionKinds: assertions.map(({ kind }) => kind),
        })),
      },
      options.output,
    );
    return;
  }

  if (!options.userAgent) {
    throw new Error(
      '--user-agent or BANGUMI_USER_AGENT is required with --live; see https://github.com/bangumi/api/blob/master/docs-raw/user%20agent.md',
    );
  }

  const results = [];
  for (const [index, caseDefinition] of cases.entries()) {
    if (index > 0) await sleep(options.delayMs);
    results.push(await probeCase(caseDefinition, options));
  }

  await writeReport(
    {
      mode: 'live',
      generatedAt: new Date().toISOString(),
      baseUrl: options.baseUrl,
      delayMs: options.delayMs,
      timeoutMs: options.timeoutMs,
      userAgentProvided: true,
      liveRequestsSent: results.length,
      results,
    },
    options.output,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
