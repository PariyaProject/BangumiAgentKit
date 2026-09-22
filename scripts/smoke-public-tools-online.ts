import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createRuntimeDependenciesWithStorage, ToolRegistry } from '@bangumi-agent-kit/tools';

const SUBJECT_ID = 41529;
const LIVE_FLAG = '--live';
const USER_AGENT = process.env.BANGUMI_USER_AGENT ?? 'BangumiAgentKit/live-public-probe';

const probes: Array<{ name: string; input: Record<string, unknown> }> = [
  { name: 'bangumi.get_subject', input: { subjectId: SUBJECT_ID } },
  { name: 'bangumi.get_subject_stats', input: { subjectId: SUBJECT_ID } },
  { name: 'bangumi.get_subject_identity', input: { subjectId: SUBJECT_ID } },
  {
    name: 'bangumi.get_subject_overview',
    input: { subjectId: SUBJECT_ID, maxCast: 2, maxStaff: 2, maxRelations: 2 },
  },
  { name: 'bangumi.get_subject_cast', input: { subjectId: SUBJECT_ID, limit: 2 } },
  { name: 'bangumi.get_subject_staff', input: { subjectId: SUBJECT_ID, limit: 2 } },
  { name: 'bangumi.get_episodes', input: { subjectId: SUBJECT_ID, limit: 2, offset: 0 } },
  { name: 'bangumi.get_subject_relations', input: { subjectId: SUBJECT_ID } },
  {
    name: 'bangumi.get_revision_intelligence',
    input: { entityType: 'subject', entityId: SUBJECT_ID, limit: 1, offset: 0 },
  },
  { name: 'bangumi.get_latest_subject_revision', input: { subjectId: SUBJECT_ID } },
  { name: 'bangumi.get_calendar', input: {} },
  { name: 'bangumi.get_calendar_intelligence', input: { weekday: 1, maxPerDay: 1, maxTotal: 1 } },
  { name: 'bangumi.search_characters', input: { query: 'チト', limit: 2, offset: 0 } },
  { name: 'bangumi.get_character', input: { characterId: 17325 } },
  { name: 'bangumi.search_persons', input: { query: '水瀬いのり', limit: 2, offset: 0 } },
  { name: 'bangumi.get_person', input: { personId: 3474 } },
  { name: 'bangumi.get_person_profile', input: { personId: 3474, includeCredits: false, maxSubjects: 2, maxCharacters: 2 } },
  { name: 'bangumi.get_episode', input: { episodeId: 199013 } },
  { name: 'bangumi.list_revisions', input: { entityType: 'subject', entityId: SUBJECT_ID, limit: 1, offset: 0 } },
  { name: 'bangumi.get_subject_stats_intelligence', input: { subjectId: SUBJECT_ID } },
  { name: 'bangumi.get_series_watch_order', input: { subjectId: SUBJECT_ID, depth: 0, maxNodes: 1 } },
  { name: 'bangumi.get_person_activity', input: { personId: 3474, windowMonths: 3, maxRelations: 1, maxSubjectDetails: 1, maxRows: 1 } },
  { name: 'bangumi.get_person_collaboration', input: { personId: 3474, maxRelations: 1, maxSubjects: 1, maxCollaborators: 1, maxSharedSubjects: 1 } },
  { name: 'bangumi.aggregate_subject_cohort', input: { cohort: { query: { media: 'anime', year: 2012, resultMode: 'all' } }, maxSubjects: 1 } },
  { name: 'bangumi.compare_subject_cohorts', input: { cohorts: [{ query: { media: 'anime', year: 2012, resultMode: 'all' } }], maxSubjects: 1 } },
  { name: 'bangumi.describe_operation', input: { operationId: 'getSubjectById' } },
  { name: 'bangumi.get_character_credit_integrity', input: { characterId: 17325, maxSubjects: 1, maxPersons: 1 } },
  { name: 'bangumi.get_episode_guide', input: { subjectId: SUBJECT_ID, maxEpisodes: 1, includeDescriptions: false } },
  { name: 'bangumi.get_episode_integrity', input: { subjectId: SUBJECT_ID, maxEpisodes: 1, includeDescriptions: false } },
  { name: 'bangumi.get_revision', input: { entityType: 'subject', revisionId: 1567985 } },
  { name: 'bangumi.get_subject_comparison', input: { subjectIds: [SUBJECT_ID, 46729], maxCast: 1, maxStaff: 1, maxRelations: 1 } },
  { name: 'bangumi.get_subject_overlap', input: { subjectIds: [SUBJECT_ID, 46729], maxCast: 1, maxStaff: 1, maxPairs: 1, maxPeople: 1 } },
  { name: 'bangumi.get_user', input: { username: 'xiaonvsheng' } },
  { name: 'bangumi.render_calendar', input: { weekday: 1, maxPerDay: 1, maxTotal: 1 } },
  { name: 'bangumi.render_search', input: { query: '少女終末旅行', subjectType: 2, limit: 1 } },
  { name: 'bangumi.render_episode_guide', input: { subjectId: SUBJECT_ID, maxEpisodes: 1, includeDescriptions: false } },
  { name: 'bangumi.render_episode_integrity', input: { subjectId: SUBJECT_ID, maxEpisodes: 1, includeDescriptions: false } },
  { name: 'bangumi.render_subject_card', input: { subjectId: SUBJECT_ID, includeCollection: false } },
];

function summarize(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (record.ok === false && record.error && typeof record.error === 'object') {
      const error = record.error as Record<string, unknown>;
      return {
        state: 'error',
        code: error.code ?? 'UNKNOWN_ERROR',
        ...(typeof error.upstreamStatus === 'number' ? { upstreamStatus: error.upstreamStatus } : {}),
        ...(typeof error.retryable === 'boolean' ? { retryable: error.retryable } : {}),
        ...(typeof error.message === 'string' ? { message: error.message.slice(0, 160) } : {}),
      };
    }
    const summary: Record<string, unknown> = {};
    for (const key of ['state', 'subjectId', 'id', 'total', 'observed', 'returned']) {
      if (record[key] !== undefined && (typeof record[key] !== 'object' || record[key] === null)) {
        summary[key] = record[key];
      }
    }
    for (const key of ['items', 'cast', 'productionStaff', 'relations', 'episodes', 'warnings']) {
      if (Array.isArray(record[key])) summary[`${key}Count`] = record[key].length;
    }
    return Object.keys(summary).length > 0 ? summary : { state: 'value', keys: Object.keys(record).slice(0, 16) };
  }
  return { state: 'value', type: typeof value };
}

async function main(): Promise<void> {
  if (!process.argv.includes(LIVE_FLAG)) {
    throw new Error(`Refusing live requests without ${LIVE_FLAG}.`);
  }

  let requestCount = 0;
  const publicHttpClient = new HttpClient({
    userAgent: USER_AGENT,
    fetchFn: async (input, init) => {
      requestCount += 1;
      return await fetch(input, init);
    },
  });
  const storage = new MemoryStorage();
  const deps = createRuntimeDependenciesWithStorage(storage, {
    secretKey: 'live-probe-secret-key-012345678901234567890123',
    publicHttpClient,
  });
  const registry = new ToolRegistry(deps);
  const startedAt = new Date().toISOString();
  const results: Array<Record<string, unknown>> = [];

  try {
    for (const [index, probe] of probes.entries()) {
      const before = requestCount;
      let result: unknown;
      try {
        result = await registry.executeTool(probe.name, probe.input, {
          principalId: 'live-probe-principal',
          botInstanceId: 'live-probe-bot',
          conversationId: `live-probe-${probe.name}`,
        });
      } catch (error) {
        const detail = error as {
          code?: unknown;
          upstreamStatus?: unknown;
          retryable?: unknown;
          message?: unknown;
        };
        result = {
          ok: false,
          error: {
            code: typeof detail.code === 'string' ? detail.code : error instanceof Error ? error.name : 'UNKNOWN_ERROR',
            ...(typeof detail.upstreamStatus === 'number' ? { upstreamStatus: detail.upstreamStatus } : {}),
            ...(typeof detail.retryable === 'boolean' ? { retryable: detail.retryable } : {}),
            ...(typeof detail.message === 'string' ? { message: detail.message.slice(0, 160) } : {}),
          },
        };
      }
      results.push({
        tool: probe.name,
        input: probe.input,
        httpRequests: requestCount - before,
        result: summarize(result),
      });
      if (index < probes.length - 1) await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  } finally {
    await registry.close();
  }

  const report = {
    observedAt: startedAt,
    mode: 'read_only_public_api_smoke',
    subjectId: SUBJECT_ID,
    userAgent: USER_AGENT,
    probeCount: probes.length,
    httpRequests: requestCount,
    limits: ['one known public subject', 'sequential probes with 1.2s spacing', 'no OAuth', 'no writes', 'summaries only'],
    results,
  };
  const date = startedAt.slice(0, 10);
  const output = join(process.cwd(), 'docs', 'live-probes', `public-tools-${date}.json`);
  await mkdir(join(process.cwd(), 'docs', 'live-probes'), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ ...report, output }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
