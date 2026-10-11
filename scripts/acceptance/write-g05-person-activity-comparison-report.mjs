import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  G05_ANSWER_CHECK_METHOD,
  G05_ARGUMENT_PROFILE,
  G05_EXPECTED_QUERY_ARGUMENTS,
  verifyG05PersonActivityComparisonAnswer,
} from './g05-person-activity-comparison-answer-check.mjs';
import { assertG05CandidateReviewGate } from './run-g05-person-activity-comparison-codex-agent-mcp.mjs';
import {
  computeMcpBundleSha256,
  gitRepositoryText,
  readG26McpBundleAttestation,
  sanitizeGitRepositoryEnvironment,
} from '../lib/g26-mcp-bundle.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RUN_NUMBER = 95;
const FRONTIER_ID = 'G05';
const EPOCH_ID = 'run95-g05-current-source-luna-agent-mcp-refresh';
const TOOL_NAME = 'bangumi.get_person_activity';
const SERVER_ID = 'bgk_g05_one_tool';
const MODEL = 'gpt-6-luna';
const REASONING_EFFORT = 'max';
const REPORT_PATH = path.join(ROOT, 'docs/live-probes/g05-person-activity-comparison-run95.json');
const CLAIM_PATH = path.join(
  ROOT,
  gitRepositoryText(ROOT, ['rev-parse', '--git-common-dir']),
  'pariya-agent-state/g05-run95-one-shot-claim.json',
);
const SERVER_PRIVACY = {
  authProfile: 'anonymous',
  oauthAttempted: false,
  accountDataRead: false,
  writesAttempted: false,
  qqPipelineTested: false,
  timClientTested: false,
  promptStored: false,
  answerStored: false,
  rawResultStored: false,
  artifactImageBytesStored: false,
  credentialsStored: false,
};
const PRIVACY = { ...SERVER_PRIVACY, communityRead: false };
const REPORT_FIELDS = [
  'schemaVersion', 'evidenceKind', 'runNumber', 'frontierId', 'scenarioId', 'epochId',
  'profile', 'model', 'reasoningEffort', 'reviewerId', 'codexCliVersion', 'sourceRevision',
  'baseSha', 'prNumber', 'mcpBundleSha256', 'observedAt', 'toolName', 'argumentProfile',
  'expectedArgumentsSha256', 'catalogSha256', 'toolDescriptionSha256', 'inputSchemaSha256',
  'serverToolNames', 'serverToolCount', 'mcpServerNames', 'processExitCode', 'resultStatus',
  'eventStreamParsed', 'codexMcpToolEventCount', 'nonMcpToolEventCount', 'nonMcpToolTypes',
  'shellToolCallCount', 'allowedCallCount', 'deniedCallCount', 'answerCheckMethod',
  'answerChecks', 'answerCounters', 'toolCalls', 'toolTextUtf8Bytes', 'resultSummary',
  'resultByteLength', 'resultSha256', 'answerUtf8Bytes', 'answerSha256', 'sourceOperations', 'privacy',
];
const RESULT_SUMMARY_FIELDS = [
  'personId', 'kind', 'media', 'state', 'comparisonState', 'window', 'recent', 'previous',
  'delta', 'peak', 'rowCount', 'rowDigest', 'sourceOperations',
];
const FORBIDDEN_SUMMARY_KEYS = new Set([
  'answer', 'rawAnswer', 'rawResult', 'toolOutput', 'prompt', 'rows', 'subjectId',
  'subjectName', 'subjectNameCn', 'title', 'relationId', 'characterName', 'rawRole',
]);

const canonicalJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
};
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function sanitizeHarnessEnvironment(source = process.env) {
  const environment = sanitizeGitRepositoryEnvironment(source);
  for (const key of Object.keys(environment)) {
    if (key === 'GH_TOKEN' || key === 'GITHUB_TOKEN') continue;
    if (/(?:BANGUMI|BGM_|OAUTH|TOKEN|SECRET|CREDENTIAL|API[_-]?KEY)/iu.test(key)) delete environment[key];
  }
  return environment;
}

function readHarnessStatus() {
  const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts/agent-harness.mjs'), 'status', '--run', String(RUN_NUMBER)], {
    cwd: ROOT, env: sanitizeHarnessEnvironment(), encoding: 'utf8', maxBuffer: 2 * 1024 * 1024,
    timeout: 30_000, stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.error || result.status !== 0) throw new Error('Unable to revalidate live Run 95 Harness status.');
  try { return JSON.parse(result.stdout ?? ''); } catch { throw new Error('Live Harness status was not valid JSON.'); }
}

function readOpenPr(prNumber) {
  const result = spawnSync('gh', ['pr', 'view', String(prNumber), '--json',
    'state,isDraft,baseRefName,headRefName,headRefOid,statusCheckRollup'], {
    cwd: ROOT, env: sanitizeHarnessEnvironment(), encoding: 'utf8', maxBuffer: 64 * 1024,
    timeout: 30_000, stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.error || result.status !== 0) throw new Error('Unable to revalidate the G05 Epoch PR.');
  try { return JSON.parse(result.stdout ?? ''); } catch { throw new Error('GitHub PR state was not valid JSON.'); }
}

function fetchCurrentMaster() {
  gitRepositoryText(ROOT, ['fetch', '--no-tags', 'origin', 'master']);
  return gitRepositoryText(ROOT, ['rev-parse', 'origin/master']);
}

function readClaim(input) {
  if (!existsSync(CLAIM_PATH)) throw new Error('G05 create-once claim is absent.');
  const claim = JSON.parse(readFileSync(CLAIM_PATH, 'utf8'));
  if (claim?.schemaVersion !== 1 || claim.runNumber !== RUN_NUMBER || claim.frontierId !== FRONTIER_ID ||
      claim.epochId !== EPOCH_ID || claim.state !== 'CLAIMED' || claim.sourceRevision !== input.sourceRevision ||
      claim.baseSha !== input.baseSha || claim.prNumber !== input.prNumber || claim.reviewerId !== input.reviewerId ||
      claim.bundleSha256 !== input.bundleSha256 ||
      claim.expectedArgumentsSha256 !== sha256(canonicalJson(G05_EXPECTED_QUERY_ARGUMENTS))) {
    throw new Error('G05 report input does not match the local create-once claim.');
  }
}

function catalogHashes() {
  const catalogBytes = readFileSync(path.join(ROOT, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const tool = catalog.find((entry) => entry?.name === TOOL_NAME);
  if (!tool || tool.auth !== 'none' || tool.risk !== 'read') {
    throw new Error('G05 report requires a current anonymous read-only catalog entry.');
  }
  return {
    catalogSha256: sha256(catalogBytes),
    toolDescriptionSha256: sha256(tool.description),
    inputSchemaSha256: sha256(canonicalJson(tool.inputSchema)),
  };
}

function validateInput(input) {
  if (!isRecord(input) || input.model !== MODEL || input.reasoningEffort !== REASONING_EFFORT ||
      !/^\d+\.\d+\.\d+$/u.test(input.codexCliVersion ?? '') || input.processExitCode !== 0 ||
      input.resultStatus !== 'SUCCESS' || input.eventStreamParsed !== true ||
      input.codexMcpToolEventCount !== 1 || input.nonMcpToolEventCount !== 0 ||
      !Array.isArray(input.nonMcpToolTypes) || input.nonMcpToolTypes.length !== 0 ||
      input.shellToolCallCount !== 0 || input.allowedCallCount !== 1 || input.deniedCallCount !== 0 ||
      canonicalJson(input.serverToolNames) !== canonicalJson([TOOL_NAME]) || input.serverToolCount !== 1 ||
      canonicalJson(input.mcpServerNames) !== canonicalJson([SERVER_ID]) ||
      !sameJson(input.privacy, SERVER_PRIVACY) ||
      !Array.isArray(input.toolCalls) || input.toolCalls.length !== 1 ||
      input.toolCalls[0]?.name !== TOOL_NAME || input.toolCalls[0]?.state !== 'DONE' ||
      !Number.isSafeInteger(input.toolTextUtf8Bytes) || input.toolTextUtf8Bytes <= 0 || input.toolTextUtf8Bytes > 3600) {
    throw new Error('G05 runner input did not pass the exact one-tool, no-extra-activity, and privacy gates.');
  }
}

function sameJson(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function summaryHasForbiddenKey(value) {
  if (Array.isArray(value)) return value.some(summaryHasForbiddenKey);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, child]) =>
    FORBIDDEN_SUMMARY_KEYS.has(key) || summaryHasForbiddenKey(child));
}

function writeReport(report) {
  if (existsSync(REPORT_PATH)) throw new Error('Canonical G05 report already exists; refusing to replace it.');
  let descriptor;
  try {
    descriptor = openSync(REPORT_PATH, 'wx', 0o600);
    writeFileSync(descriptor, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    closeSync(descriptor);
  } catch {
    if (descriptor !== undefined) {
      try { closeSync(descriptor); } catch { /* Keep create-new failure. */ }
    }
    throw new Error('Canonical G05 report already exists or cannot be safely created.');
  }
}

export function buildG05PersonActivityComparisonReport(input, { observedAt = new Date().toISOString() } = {}) {
  validateInput(input);
  if (existsSync(REPORT_PATH)) throw new Error('Canonical G05 report already exists; refusing to replace it.');
  if (!/^[0-9a-f]{40}$/u.test(input.sourceRevision) || !/^[0-9a-f]{40}$/u.test(input.baseSha) ||
      !/^[0-9a-f]{64}$/u.test(input.bundleSha256) || !Number.isSafeInteger(input.prNumber) ||
      !/^gpt-6-luna-max-run95-pr\d+-round\d+$/u.test(input.reviewerId)) {
    throw new Error('G05 report requires the exact reviewed Candidate, Base, PR, bundle, and Luna Max identity.');
  }
  readClaim(input);
  const currentBaseSha = fetchCurrentMaster();
  const status = readHarnessStatus();
  const pr = readOpenPr(input.prNumber);
  const gate = assertG05CandidateReviewGate(status, pr, {
    sourceRevision: input.sourceRevision,
    currentBaseSha,
  });
  if (gate.prNumber !== input.prNumber || gate.baseSha !== input.baseSha || gate.reviewerId !== input.reviewerId ||
      computeMcpBundleSha256(ROOT) !== input.bundleSha256 ||
      readG26McpBundleAttestation(ROOT) !== input.bundleSha256) {
    throw new Error('G05 report Candidate, reviewer, Base, or MCP bundle no longer matches the live gates.');
  }
  const checks = catalogHashes();
  const answerResult = verifyG05PersonActivityComparisonAnswer(
    input.answer,
    input.queryArguments,
    input.toolOutput,
    input.toolCalls,
    input.toolTextUtf8Bytes,
  );
  if (!answerResult.passed || !answerResult.resultSummary) {
    return { passed: false, answerChecks: answerResult.answerChecks, answerCounters: answerResult.answerCounters };
  }
  const report = buildG05SanitizedReport(input, answerResult, checks, observedAt);
  return {
    passed: true,
    report,
    answerChecks: answerResult.answerChecks,
    answerCounters: answerResult.answerCounters,
    resultSummary: answerResult.resultSummary,
  };
}

export function buildG05SanitizedReport(input, answerResult, hashes, observedAt) {
  if (!answerResult?.passed || !answerResult.resultSummary || !isRecord(hashes) ||
      !/^[0-9a-f]{40}$/u.test(input.sourceRevision ?? '') || !/^[0-9a-f]{40}$/u.test(input.baseSha ?? '') ||
      !Number.isSafeInteger(input.prNumber) || !/^gpt-6-luna-max-run95-pr\d+-round\d+$/u.test(input.reviewerId ?? '') ||
      !sameJson(Object.keys(answerResult.resultSummary).sort(), [...RESULT_SUMMARY_FIELDS].sort()) ||
      summaryHasForbiddenKey(answerResult.resultSummary) || !isRecord(answerResult.answerChecks) ||
      Object.values(answerResult.answerChecks).some((item) => item !== true) || !isRecord(answerResult.answerCounters) ||
      Object.values(answerResult.answerCounters).some((item) => !Number.isSafeInteger(item) || item < 0)) {
    throw new Error('G05 sanitized report requires passing checks and exact reviewed Candidate metadata.');
  }
  const report = {
    schemaVersion: 1,
    evidenceKind: 'codex_cli_g05_person_activity_comparison_agent_mcp',
    runNumber: RUN_NUMBER,
    frontierId: FRONTIER_ID,
    scenarioId: FRONTIER_ID,
    epochId: EPOCH_ID,
    profile: 'codex-luna-max-one-tool-v1',
    model: MODEL,
    reasoningEffort: REASONING_EFFORT,
    reviewerId: input.reviewerId,
    codexCliVersion: input.codexCliVersion,
    sourceRevision: input.sourceRevision,
    baseSha: input.baseSha,
    prNumber: input.prNumber,
    mcpBundleSha256: input.bundleSha256,
    observedAt,
    toolName: TOOL_NAME,
    argumentProfile: G05_ARGUMENT_PROFILE,
    expectedArgumentsSha256: sha256(canonicalJson(G05_EXPECTED_QUERY_ARGUMENTS)),
    ...hashes,
    serverToolNames: [TOOL_NAME],
    serverToolCount: 1,
    mcpServerNames: [SERVER_ID],
    processExitCode: 0,
    resultStatus: 'SUCCESS',
    eventStreamParsed: true,
    codexMcpToolEventCount: 1,
    nonMcpToolEventCount: 0,
    nonMcpToolTypes: [],
    shellToolCallCount: 0,
    allowedCallCount: 1,
    deniedCallCount: 0,
    answerCheckMethod: G05_ANSWER_CHECK_METHOD,
    answerChecks: answerResult.answerChecks,
    answerCounters: answerResult.answerCounters,
    toolCalls: [{ name: TOOL_NAME, state: 'DONE' }],
    toolTextUtf8Bytes: input.toolTextUtf8Bytes,
    resultSummary: answerResult.resultSummary,
    resultByteLength: answerResult.resultByteLength,
    resultSha256: answerResult.resultSha256,
    answerUtf8Bytes: answerResult.answerUtf8Bytes,
    answerSha256: answerResult.answerSha256,
    sourceOperations: answerResult.resultSummary.sourceOperations,
    privacy: { ...PRIVACY },
  };
  if (Object.keys(report).sort().join('\n') !== [...REPORT_FIELDS].sort().join('\n')) {
    throw new Error('G05 report schema construction drifted.');
  }
  return report;
}

async function readInput() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function main() {
  try {
    const input = await readInput();
    const built = buildG05PersonActivityComparisonReport(input);
    if (!built.passed || !built.report) {
      process.stdout.write(`${JSON.stringify(built)}\n`);
      process.exitCode = 1;
      return;
    }
    const relative = path.relative(ROOT, REPORT_PATH).split(path.sep).join('/');
    if (relative !== 'docs/live-probes/g05-person-activity-comparison-run95.json') {
      throw new Error('G05 report path is fixed to the canonical acceptance artifact.');
    }
    writeReport(built.report);
    process.stdout.write(`${JSON.stringify({
      passed: true,
      answerChecks: built.answerChecks,
      answerCounters: built.answerCounters,
      resultSummary: built.resultSummary,
    })}\n`);
  } catch {
    process.stdout.write(`${JSON.stringify({ passed: false, state: 'INCONCLUSIVE' })}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
