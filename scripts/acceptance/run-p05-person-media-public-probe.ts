import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createRuntimeDependenciesWithStorage, ToolRegistry } from '@bangumi-agent-kit/tools';
import {
  P05_ARGUMENTS,
  P05_ARGUMENT_PROFILE,
  P05_EPOCH_ID,
  P05_TOOL_NAME,
  p05CandidateGateIsReady,
  p05PersonMediaSummaryIsValid,
  projectP05PersonMediaSummary,
} from './p05-person-media-public-probe.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RUN_NUMBER = 95;
const PR_NUMBER = 166;
const RUNNER_ARGS = ['--live', '--run', String(RUN_NUMBER), '--pr', String(PR_NUMBER)];
const REPORT_PATH = path.join(ROOT, 'docs/live-probes/p05-person-media-public-probe-run95.json');
const HARNESS_SCRIPT = path.join(ROOT, 'scripts/agent-harness.mjs');
const RUNNER_PATH = fileURLToPath(import.meta.url);
const EXPECTED_ARGUMENTS_CANONICAL =
  '{"includeCredits":false,"maxCharacters":1,"maxSubjects":500,"personId":3474}';

function command(file, args) {
  return execFileSync(file, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function git(...args) {
  return command('git', args);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function assertRunnerArguments(args: string[]): void {
  if (canonicalJson(args) !== canonicalJson(RUNNER_ARGS)) {
    throw new Error('P05 public probe requires the exact --live --run 95 --pr 166 arguments.');
  }
}

function readCandidateGate() {
  const status = JSON.parse(command(process.execPath, [
    HARNESS_SCRIPT,
    'status',
    '--run',
    String(RUN_NUMBER),
    '--pr',
    String(PR_NUMBER),
  ]));
  const pr = JSON.parse(command('gh', [
    'pr',
    'view',
    String(PR_NUMBER),
    '--json',
    'number,state,isDraft,baseRefName,baseRefOid,headRefOid,statusCheckRollup',
  ]));
  const currentHead = git('rev-parse', 'HEAD');
  const currentBaseSha = git('rev-parse', 'origin/master');
  const currentBranch = git('branch', '--show-current');
  if (!p05CandidateGateIsReady({ status, pr, currentHead, currentBaseSha, currentBranch })) {
    throw new Error('P05 public probe refused: exact Candidate/Base CI and GPT-6 Luna Max PASS are not current.');
  }
  return { status, pr, currentHead, currentBaseSha, currentBranch };
}

function createLocalClaim(candidateSha: string, baseSha: string, reviewerId: string): string {
  const commonDir = path.resolve(ROOT, git('rev-parse', '--git-common-dir'));
  const stateDir = path.join(commonDir, 'run95-local-claims');
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  const claimPath = path.join(stateDir, 'p05-run95-person-media-public-probe-claim.json');
  const claim = {
    schemaVersion: 1,
    state: 'CLAIMED',
    runNumber: RUN_NUMBER,
    frontierId: 'P05',
    epochId: P05_EPOCH_ID,
    prNumber: PR_NUMBER,
    candidateSha,
    baseSha,
    reviewerId,
    toolName: P05_TOOL_NAME,
    argumentProfile: P05_ARGUMENT_PROFILE,
    expectedArgumentsSha256: sha256(canonicalJson(P05_ARGUMENTS)),
    claimedAt: new Date().toISOString(),
  };
  let descriptor: number | undefined;
  try {
    descriptor = openSync(claimPath, 'wx', 0o600);
    writeFileSync(descriptor, `${JSON.stringify(claim, null, 2)}\n`, 'utf8');
    closeSync(descriptor);
  } catch {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        /* Keep the create-once refusal. */
      }
    }
    throw new Error('P05 public probe claim already exists or is uncertain; refusing another request.');
  }
  return claimPath;
}

async function main(): Promise<void> {
  assertRunnerArguments(process.argv.slice(2));
  if (git('status', '--porcelain')) {
    throw new Error('P05 public probe requires a clean Candidate checkout.');
  }
  git('fetch', 'origin', 'master');
  const { status, currentHead, currentBaseSha } = readCandidateGate();
  if (existsSync(REPORT_PATH)) {
    throw new Error('P05 public probe report already exists; refusing a second observation.');
  }
  const latestReview = status.epoch.state.review_history.at(-1);
  const claimPath = createLocalClaim(currentHead, currentBaseSha, latestReview.reviewer_id);

  let requestCount = 0;
  const publicHttpClient = new HttpClient({
    userAgent: 'BangumiAgentKit/run95-p05-public-probe',
    fetchFn: async (input, init) => {
      requestCount += 1;
      return await fetch(input, init);
    },
  });
  const registry = new ToolRegistry(createRuntimeDependenciesWithStorage(new MemoryStorage(), {
    secretKey: 'p05-read-only-probe-local-memory-only',
    publicHttpClient,
  }));

  let result: unknown = null;
  let toolCallErrorType: string | null = null;
  try {
    result = await registry.executeTool(P05_TOOL_NAME, P05_ARGUMENTS, {
      principalId: 'run95-p05-public-probe',
      botInstanceId: 'run95-p05-public-probe',
      conversationId: 'run95-p05-public-probe',
    });
  } catch (error) {
    toolCallErrorType = error instanceof Error ? error.name : 'UNKNOWN_ERROR';
  } finally {
    await registry.close();
  }

  const summary = result ? projectP05PersonMediaSummary(result) : null;
  const assertions = {
    exactHarnessCandidateGate: true,
    exactPublicReadArguments: canonicalJson(P05_ARGUMENTS) === EXPECTED_ARGUMENTS_CANONICAL,
    exactlyOneToolInvocation: true,
    anonymousPublicRequestObserved: requestCount > 0,
    personMediaSummaryValid: summary !== null && p05PersonMediaSummaryIsValid(summary),
  };
  const passed = Object.values(assertions).every(Boolean);
  const serializedResult = result === null ? '' : JSON.stringify(result);
  const report = {
    schemaVersion: 1,
    evidenceKind: 'bangumi_p05_person_media_direct_public_tool_registry_v1',
    runNumber: RUN_NUMBER,
    frontierId: 'P05',
    epochId: P05_EPOCH_ID,
    prNumber: PR_NUMBER,
    sourceRevision: currentHead,
    baseSha: currentBaseSha,
    ciSha: status.epoch.state.ci.sha,
    ciStatus: status.epoch.state.ci.status,
    reviewerId: latestReview.reviewer_id,
    reviewVerdict: latestReview.verdict,
    reviewPassSha: status.epoch.state.review_pass_sha,
    observedAt: new Date().toISOString(),
    toolName: P05_TOOL_NAME,
    argumentProfile: P05_ARGUMENT_PROFILE,
    arguments: P05_ARGUMENTS,
    toolInvocationCount: 1,
    httpRequests: requestCount,
    resultState: passed ? 'SUCCESS' : 'INCONCLUSIVE',
    resultSummary: summary,
    resultByteLength: Buffer.byteLength(serializedResult, 'utf8'),
    resultSha256: serializedResult ? sha256(serializedResult) : null,
    toolCallErrorType,
    runnerScriptSha256: sha256(readFileSync(RUNNER_PATH)),
    assertions,
    limits: [
      'anonymous public ToolRegistry read only',
      'one exact get_person_profile invocation',
      'subject type counts describe only returned relation rows',
      'upstream relation completeness is undocumented',
      'no OAuth, account, community, HTML, writes, QQ, or TIM',
    ],
  };
  mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  const claim = JSON.parse(readFileSync(claimPath, 'utf8')) as Record<string, unknown>;
  writeFileSync(claimPath, `${JSON.stringify({
    ...claim,
    state: 'TERMINAL',
    resultState: report.resultState,
    reportPath: path.relative(ROOT, REPORT_PATH),
    reportSha256: sha256(readFileSync(REPORT_PATH)),
    finishedAt: new Date().toISOString(),
  }, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify({
    reportPath: path.relative(ROOT, REPORT_PATH),
    resultState: report.resultState,
    httpRequests: requestCount,
    summary,
    assertions,
  }, null, 2)}\n`);
  if (!passed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
