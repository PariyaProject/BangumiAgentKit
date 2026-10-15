import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createRuntimeDependenciesWithStorage, ToolRegistry } from '@bangumi-agent-kit/tools';

const LIVE_FLAG = '--live';
const TOOL = 'bangumi.get_person_profile';
const MAX_HTTP_REQUESTS = 4;
const OUTPUT_PATH = 'docs/live-probes/public-tools-p02-person-profile-chronology-2026-10-15.json';
const USER_AGENT = process.env.BANGUMI_USER_AGENT ?? 'BangumiAgentKit/P02-public-chronology-probe';
const INPUT = {
  personId: 13684,
  includeCredits: false,
  maxSubjects: 500,
  maxCharacters: 1,
  includeChronology: true,
  maxChronologySubjects: 1,
} as const;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function safeError(error: unknown): UnknownRecord {
  const detail = isRecord(error) ? error : {};
  return {
    state: 'error',
    code:
      typeof detail.code === 'string'
        ? detail.code
        : error instanceof Error
          ? error.name
          : 'UNKNOWN_ERROR',
    ...(typeof detail.upstreamStatus === 'number' ? { upstreamStatus: detail.upstreamStatus } : {}),
    ...(typeof detail.retryable === 'boolean' ? { retryable: detail.retryable } : {}),
  };
}

function summarize(value: unknown): UnknownRecord {
  if (!isRecord(value)) return { state: 'invalid_result' };
  if (value.ok === false && isRecord(value.error)) {
    return {
      state: 'error',
      code: typeof value.error.code === 'string' ? value.error.code : 'UNKNOWN_ERROR',
      ...(typeof value.error.upstreamStatus === 'number'
        ? { upstreamStatus: value.error.upstreamStatus }
        : {}),
      ...(typeof value.error.retryable === 'boolean' ? { retryable: value.error.retryable } : {}),
    };
  }

  const coverage = isRecord(value.coverage) ? value.coverage : {};
  const subjects = isRecord(coverage.subjects) ? coverage.subjects : {};
  const chronology = isRecord(value.releaseChronology) ? value.releaseChronology : {};
  const earliest = isRecord(chronology.earliestObserved) ? chronology.earliestObserved : {};
  const latest = isRecord(chronology.latestObserved) ? chronology.latestObserved : {};
  const earliestSubjects = Array.isArray(earliest.subjects) ? earliest.subjects : [];
  const latestSubjects = Array.isArray(latest.subjects) ? latest.subjects : [];

  return {
    state: typeof value.state === 'string' ? value.state : 'unknown',
    subjectCoverage: {
      observed: subjects.observed,
      returned: subjects.returned,
      truncated: subjects.truncated,
    },
    releaseChronology: {
      state: chronology.state,
      sourceCompleteness: chronology.sourceCompleteness,
      dateSemantics: chronology.dateSemantics,
      selectedSubjectDetails: chronology.selectedSubjectDetails,
      succeededSubjectDetails: chronology.succeededSubjectDetails,
      failedSubjectDetails: chronology.failedSubjectDetails,
      validDateSubjects: chronology.validDateSubjects,
      missingDateSubjects: chronology.missingDateSubjects,
      invalidDateSubjects: chronology.invalidDateSubjects,
      omittedAnimeSubjects: chronology.omittedAnimeSubjects,
      ...(typeof earliest.date === 'string'
        ? { earliestObserved: { date: earliest.date, tiedSubjectCount: earliestSubjects.length } }
        : {}),
      ...(typeof latest.date === 'string'
        ? { latestObserved: { date: latest.date, tiedSubjectCount: latestSubjects.length } }
        : {}),
    },
  };
}

function validate(
  value: unknown,
  httpRequests: number,
  budgetBlocked: boolean,
): Record<string, boolean> {
  const record = isRecord(value) ? value : {};
  const coverage = isRecord(record.coverage) ? record.coverage : {};
  const subjects = isRecord(coverage.subjects) ? coverage.subjects : {};
  const chronology = isRecord(record.releaseChronology) ? record.releaseChronology : {};
  const selected = chronology.selectedSubjectDetails;
  const succeeded = chronology.succeededSubjectDetails;
  const failed = chronology.failedSubjectDetails;
  const chronologyState = chronology.state;
  const countsAreValid = [
    chronology.animeRelationRowsReturned,
    chronology.uniqueAnimeSubjects,
    selected,
    succeeded,
    failed,
    chronology.validDateSubjects,
    chronology.missingDateSubjects,
    chronology.invalidDateSubjects,
    chronology.omittedAnimeSubjects,
  ].every(nonNegativeInteger);
  const selectionConsistent =
    nonNegativeInteger(selected) &&
    nonNegativeInteger(succeeded) &&
    nonNegativeInteger(failed) &&
    succeeded + failed === selected;
  const dateCountsConsistent =
    nonNegativeInteger(succeeded) &&
    nonNegativeInteger(chronology.validDateSubjects) &&
    nonNegativeInteger(chronology.missingDateSubjects) &&
    nonNegativeInteger(chronology.invalidDateSubjects) &&
    chronology.validDateSubjects +
      chronology.missingDateSubjects +
      chronology.invalidDateSubjects ===
      succeeded;
  const observedSubjects = subjects.observed;
  const returnedSubjects = subjects.returned;
  const subjectCountsAreValid =
    nonNegativeInteger(observedSubjects) &&
    nonNegativeInteger(returnedSubjects) &&
    typeof subjects.truncated === 'boolean';
  const subjectCountsConsistent =
    nonNegativeInteger(observedSubjects) &&
    nonNegativeInteger(returnedSubjects) &&
    returnedSubjects <= observedSubjects;
  const assertions = {
    httpRequestObserved: httpRequests > 0,
    httpRequestBudget: httpRequests <= MAX_HTTP_REQUESTS && !budgetBlocked,
    nonEmptySummary: record.state === 'partial' && isRecord(record.person),
    noErrorResult: record.state !== 'error' && record.ok !== false,
    nonNegativeCounts: countsAreValid && subjectCountsAreValid,
    countConsistency: selectionConsistent && dateCountsConsistent && subjectCountsConsistent,
    nonErrorResult: record.state === 'partial',
    correctPerson: isRecord(record.person) && record.person.id === INPUT.personId,
    chronologyReturned: chronologyState === 'partial' || chronologyState === 'not_computable',
    chronologyBounded: nonNegativeInteger(selected) && selected <= INPUT.maxChronologySubjects,
    chronologyCountsConsistent: selectionConsistent && countsAreValid,
    relationCoverageConsistent: subjectCountsAreValid && subjectCountsConsistent,
  };
  return { ...assertions, passed: Object.values(assertions).every(Boolean) };
}

async function main(): Promise<void> {
  if (!process.argv.includes(LIVE_FLAG)) {
    throw new Error(`Refusing live requests without ${LIVE_FLAG}.`);
  }

  const output = join(process.cwd(), OUTPUT_PATH);
  let reportExists = false;
  try {
    await access(output);
    reportExists = true;
  } catch (error) {
    if (!isRecord(error) || error.code !== 'ENOENT') throw error;
  }
  if (reportExists)
    throw new Error(`Refusing to repeat an existing P02 profile report: ${OUTPUT_PATH}`);

  const gitDirectory = execFileSync('git', ['rev-parse', '--git-dir'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  }).trim();
  const attemptMarker = resolve(
    process.cwd(),
    gitDirectory,
    'run95-p02-person-profile-chronology.claimed',
  );
  await writeFile(
    attemptMarker,
    `${JSON.stringify({
      run: 95,
      profile: 'p02-person-profile-chronology-public-v1',
      tool: TOOL,
      argumentsSha256: createHash('sha256').update(JSON.stringify(INPUT)).digest('hex'),
      claimedAt: new Date().toISOString(),
    })}\n`,
    { encoding: 'utf8', flag: 'wx' },
  );

  let httpRequests = 0;
  let budgetBlocked = false;
  const client = new HttpClient({
    userAgent: USER_AGENT,
    fetchFn: async (input, init) => {
      if (httpRequests >= MAX_HTTP_REQUESTS) {
        budgetBlocked = true;
        throw new Error('P02 public profile request budget reached; no fifth request sent.');
      }
      httpRequests += 1;
      return await fetch(input, init);
    },
  });
  const storage = new MemoryStorage();
  const deps = createRuntimeDependenciesWithStorage(storage, {
    secretKey: 'p02-public-probe-secret-key-012345678901234567890123',
    publicHttpClient: client,
  });
  const registry = new ToolRegistry(deps);
  const observedAt = new Date().toISOString();
  let result: unknown;
  try {
    try {
      result = await registry.executeTool(TOOL, INPUT, {
        principalId: 'p02-public-probe-principal',
        botInstanceId: 'p02-public-probe-bot',
        conversationId: 'p02-public-profile-chronology',
      });
    } catch (error) {
      result = safeError(error);
    }
  } finally {
    await registry.close();
  }

  const summary = summarize(result);
  const assertions = validate(result, httpRequests, budgetBlocked);
  const report = {
    schemaVersion: 1,
    evidenceKind: 'bangumi_public_api_tool_registry_smoke',
    observedAt,
    mode: 'read_only_public_api_smoke',
    sourceProgram: 'scripts/smoke-person-profile-chronology-online.ts',
    catalogSha256: createHash('sha256')
      .update(await readFile(join(process.cwd(), 'docs', 'tool-catalog.json')))
      .digest('hex'),
    probeScriptSha256: createHash('sha256')
      .update(
        await readFile(join(process.cwd(), 'scripts', 'smoke-person-profile-chronology-online.ts')),
      )
      .digest('hex'),
    requestBudget: { maxPerTool: MAX_HTTP_REQUESTS, maxTotal: MAX_HTTP_REQUESTS },
    httpRequests,
    budgetBlocked,
    selectedTools: [TOOL],
    probeCount: 1,
    input: INPUT,
    result: summary,
    results: [{ tool: TOOL, input: INPUT, httpRequests, result: summary, assertions }],
    limits: [
      'one anonymous public ToolRegistry call',
      'hard maximum of four outgoing HTTP requests',
      'one returned anime subject detail at most',
      'summary only; no names, relation/subject IDs, full payloads, or image bytes',
      'observed sample only; no career-wide chronology claim',
    ],
  };
  await mkdir(join(process.cwd(), 'docs', 'live-probes'), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  process.stdout.write(`${JSON.stringify({ ...report, output: OUTPUT_PATH }, null, 2)}\n`);
  process.exit(0);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
