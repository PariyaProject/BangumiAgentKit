import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createRuntimeDependenciesWithStorage, ToolRegistry } from '@bangumi-agent-kit/tools';

const LIVE_FLAG = '--live';
const USERNAME = 'xiaonvsheng';
const USER_AGENT = 'BangumiAgentKit/public-optional-collection-probe';
const MAX_REQUESTS = 10;
const SPACING_MS = 1_500;

type ProbeName =
  | 'bangumi.list_collections'
  | 'bangumi.get_collection'
  | 'bangumi.list_character_collections'
  | 'bangumi.get_character_collection'
  | 'bangumi.list_person_collections'
  | 'bangumi.get_person_collection';

type ProbeResult = {
  tool: ProbeName;
  route: string;
  requests: number;
  statusCodes: number[];
  routeMatched: boolean;
  authorizationHeaderPresent: boolean;
  resultStateAccepted: boolean;
  statusAccepted: boolean;
  result: {
    state: string;
    outcome: string;
    observed?: number;
    returned?: number;
  };
  state: string;
  observed?: number;
  returned?: number;
  truncated?: boolean;
  publicAuthScope?: string;
  usedListItemAsTarget?: boolean;
  errorCode?: string;
};

const routePatterns: Record<ProbeName, RegExp> = {
  'bangumi.list_collections': /^\/v0\/users\/[^/]+\/collections$/,
  'bangumi.get_collection': /^\/v0\/users\/[^/]+\/collections\/\d+$/,
  'bangumi.list_character_collections': /^\/v0\/users\/[^/]+\/collections\/-\/characters$/,
  'bangumi.get_character_collection': /^\/v0\/users\/[^/]+\/collections\/-\/characters\/\d+$/,
  'bangumi.list_person_collections': /^\/v0\/users\/[^/]+\/collections\/-\/persons$/,
  'bangumi.get_person_collection': /^\/v0\/users\/[^/]+\/collections\/-\/persons\/\d+$/,
};

const routeLabels: Record<ProbeName, string> = {
  'bangumi.list_collections': 'GET /v0/users/{username}/collections',
  'bangumi.get_collection': 'GET /v0/users/{username}/collections/{subject_id}',
  'bangumi.list_character_collections': 'GET /v0/users/{username}/collections/-/characters',
  'bangumi.get_character_collection':
    'GET /v0/users/{username}/collections/-/characters/{character_id}',
  'bangumi.list_person_collections': 'GET /v0/users/{username}/collections/-/persons',
  'bangumi.get_person_collection': 'GET /v0/users/{username}/collections/-/persons/{person_id}',
};

function summarize(
  value: unknown,
): Omit<
  ProbeResult,
  | 'tool'
  | 'route'
  | 'requests'
  | 'statusCodes'
  | 'routeMatched'
  | 'authorizationHeaderPresent'
  | 'resultStateAccepted'
  | 'statusAccepted'
  | 'result'
> {
  if (!value || typeof value !== 'object') return { state: 'invalid_result' };
  const record = value as Record<string, unknown>;
  if (record.ok === false) {
    const error =
      record.error && typeof record.error === 'object'
        ? (record.error as Record<string, unknown>)
        : {};
    return {
      state: 'error',
      errorCode: typeof error.code === 'string' ? error.code : 'UNKNOWN_ERROR',
    };
  }
  if (typeof record.found === 'boolean') {
    return {
      state: record.found ? 'found' : 'not_found',
      ...(typeof (record.source as Record<string, unknown> | undefined)?.authScope === 'string'
        ? { publicAuthScope: String((record.source as Record<string, unknown>).authScope) }
        : {}),
    };
  }
  const items = Array.isArray(record.items) ? record.items : undefined;
  return {
    state: typeof record.state === 'string' ? record.state : 'ok',
    ...(typeof record.observed === 'number' ? { observed: record.observed } : {}),
    ...(typeof record.returned === 'number'
      ? { returned: record.returned }
      : items
        ? { returned: items.length }
        : {}),
    ...(typeof record.truncated === 'boolean' ? { truncated: record.truncated } : {}),
    ...(typeof (record.source as Record<string, unknown> | undefined)?.authScope === 'string'
      ? { publicAuthScope: String((record.source as Record<string, unknown>).authScope) }
      : {}),
  };
}

function firstPositiveId(result: unknown, fallback: number): { id: number; fromList: boolean } {
  if (!result || typeof result !== 'object') return { id: fallback, fromList: false };
  const items = (result as Record<string, unknown>).items;
  if (!Array.isArray(items) || !items[0] || typeof items[0] !== 'object') {
    return { id: fallback, fromList: false };
  }
  const item = items[0] as Record<string, unknown>;
  const candidate = item.subjectId ?? item.id;
  return typeof candidate === 'number' && Number.isInteger(candidate) && candidate > 0
    ? { id: candidate, fromList: true }
    : { id: fallback, fromList: false };
}

async function main(): Promise<void> {
  if (!process.argv.includes(LIVE_FLAG)) {
    throw Object.assign(new Error('live flag required'), { code: 'LIVE_FLAG_REQUIRED' });
  }

  const startedAt = new Date().toISOString();
  let requestCount = 0;
  let activeTool: ProbeName | undefined;
  const requestStats = new Map<
    ProbeName,
    { paths: string[]; statusCodes: number[]; auth: boolean[] }
  >();
  const publicHttpClient = new HttpClient({
    userAgent: USER_AGENT,
    fetchFn: async (input, init) => {
      if (requestCount >= MAX_REQUESTS) throw new Error('PROBE_REQUEST_LIMIT');
      requestCount += 1;
      if (activeTool) {
        const stats = requestStats.get(activeTool) ?? { paths: [], statusCodes: [], auth: [] };
        const url = new URL(String(input));
        stats.paths.push(url.pathname);
        stats.auth.push(Boolean(new Headers(init?.headers).get('authorization')));
        requestStats.set(activeTool, stats);
        try {
          const response = await fetch(input, {
            ...init,
            signal: init?.signal ?? AbortSignal.timeout(15_000),
          });
          stats.statusCodes.push(response.status);
          return response;
        } catch (error) {
          stats.statusCodes.push(0);
          throw error;
        }
      }
      throw new Error('PROBE_REQUEST_WITHOUT_TOOL_CONTEXT');
    },
  });
  const storage = new MemoryStorage();
  const deps = createRuntimeDependenciesWithStorage(storage, {
    secretKey: 'disposable-public-probe-key-012345678901234567890123',
    publicHttpClient,
  });
  const registry = new ToolRegistry(deps);
  const context = {
    principalId: 'public-optional-probe',
    botInstanceId: 'public-optional-probe',
    conversationId: 'public-optional-probe',
  };
  const results: ProbeResult[] = [];
  const subjectListInput = { username: USERNAME, subjectType: 'anime', limit: 1, offset: 0 };
  const characterListInput = { username: USERNAME, maxItems: 1 };
  const personListInput = { username: USERNAME, maxItems: 1 };

  let subjectId = 41529;
  let characterId = 17325;
  let personId = 3474;
  let subjectFromList = false;
  let characterFromList = false;
  let personFromList = false;

  const execute = async (
    tool: ProbeName,
    input: Record<string, unknown>,
    usedListItemAsTarget = false,
  ): Promise<unknown> => {
    activeTool = tool;
    const beforeCount = requestCount;
    let result: unknown;
    try {
      result = await registry.executeTool(tool, input, context);
    } catch (error) {
      const code = (error as { code?: unknown }).code;
      result = {
        ok: false,
        error: {
          code:
            typeof code === 'string' ? code : error instanceof Error ? error.name : 'UNKNOWN_ERROR',
        },
      };
    } finally {
      activeTool = undefined;
    }
    const stats = requestStats.get(tool) ?? { paths: [], statusCodes: [], auth: [] };
    const summary = summarize(result);
    const routeMatched = stats.paths.length === 1 && routePatterns[tool].test(stats.paths[0] ?? '');
    const authorizationHeaderPresent = stats.auth.some(Boolean);
    const resultStateAccepted = ['found', 'not_found', 'ok', 'complete', 'partial'].includes(
      summary.state,
    );
    const statusAccepted =
      stats.statusCodes.length === 1 &&
      (stats.statusCodes[0] === 200 ||
        (summary.state === 'not_found' && stats.statusCodes[0] === 404));
    results.push({
      tool,
      route: routeLabels[tool],
      requests: requestCount - beforeCount,
      statusCodes: stats.statusCodes,
      routeMatched,
      authorizationHeaderPresent,
      resultStateAccepted,
      statusAccepted,
      result: {
        state: resultStateAccepted ? 'ok' : 'error',
        outcome: summary.state,
        ...(typeof summary.observed === 'number' ? { observed: summary.observed } : {}),
        ...(typeof summary.returned === 'number' ? { returned: summary.returned } : {}),
      },
      ...summary,
      ...(usedListItemAsTarget ? { usedListItemAsTarget: true } : {}),
    });
    return result;
  };

  try {
    const subjectListResult = await execute('bangumi.list_collections', subjectListInput);
    const subjectTarget = firstPositiveId(subjectListResult, 41529);
    subjectId = subjectTarget.id;
    subjectFromList = subjectTarget.fromList;
    await new Promise((resolve) => setTimeout(resolve, SPACING_MS));

    const characterListResult = await execute(
      'bangumi.list_character_collections',
      characterListInput,
    );
    const characterTarget = firstPositiveId(characterListResult, 17325);
    characterId = characterTarget.id;
    characterFromList = characterTarget.fromList;
    await new Promise((resolve) => setTimeout(resolve, SPACING_MS));

    const personListResult = await execute('bangumi.list_person_collections', personListInput);
    const personTarget = firstPositiveId(personListResult, 3474);
    personId = personTarget.id;
    personFromList = personTarget.fromList;
    await new Promise((resolve) => setTimeout(resolve, SPACING_MS));

    await execute('bangumi.get_collection', { username: USERNAME, subjectId }, subjectFromList);
    await new Promise((resolve) => setTimeout(resolve, SPACING_MS));
    await execute(
      'bangumi.get_character_collection',
      { username: USERNAME, characterId },
      characterFromList,
    );
    await new Promise((resolve) => setTimeout(resolve, SPACING_MS));
    await execute(
      'bangumi.get_person_collection',
      { username: USERNAME, personId },
      personFromList,
    );
  } finally {
    await registry.close();
  }

  const catalogPath = join(process.cwd(), 'docs', 'tool-catalog.json');
  const scriptPath = join(process.cwd(), 'scripts', 'smoke-public-optional-collections.ts');
  const catalogSha256 = createHash('sha256')
    .update(await readFile(catalogPath))
    .digest('hex');
  const probeScriptSha256 = createHash('sha256')
    .update(await readFile(scriptPath))
    .digest('hex');
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const passed =
    results.length === 6 &&
    results.every(
      (result) =>
        result.requests === 1 &&
        result.routeMatched &&
        !result.authorizationHeaderPresent &&
        result.resultStateAccepted &&
        result.statusAccepted &&
        (!result.publicAuthScope || result.publicAuthScope === 'public'),
    );
  const report = {
    schemaVersion: 1,
    evidenceKind: 'bangumi_optional_auth_public_collection_api_smoke',
    observedAt: startedAt,
    completedAt: new Date().toISOString(),
    sourceRevision,
    catalogSha256,
    probeScriptSha256,
    mode: 'read_only_public_api_smoke',
    passed,
    selectedTools: results.map((result) => result.tool),
    accountUsed: false,
    oauthUsed: false,
    writesPerformed: false,
    externalRequests: requestCount,
    limits: [
      'six optional-auth collection tools only',
      'one HTTP request per tool, sequential with 1.5 second spacing',
      'one public username; no OAuth, account credential, or write',
      'raw API response bodies and user identifiers omitted from this report',
    ],
    results,
  };
  const date = startedAt.slice(0, 10);
  const outputDirectory = join(process.cwd(), 'docs', 'live-probes');
  const output = join(outputDirectory, `optional-collections-${date}.json`);
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ ...report, output }, null, 2)}\n`);
  if (!passed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  const code = (error as { code?: unknown }).code;
  process.stderr.write(
    `${typeof code === 'string' ? code : error instanceof Error ? error.name : 'UNKNOWN_ERROR'}\n`,
  );
  process.exit(1);
});
