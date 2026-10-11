import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  G04_ANSWER_CHECK_METHOD,
  G04_EXPECTED_QUERY_ARGUMENTS,
  verifyG04PersonActivityAnswer,
} from './g04-person-activity-answer-check.mjs';
import {
  computeMcpBundleSha256,
  gitRepositoryText,
  readG26McpBundleAttestation,
  sanitizeGitRepositoryEnvironment,
} from '../lib/g26-mcp-bundle.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TOOL_NAME = 'bangumi.get_person_activity';
const SERVER_ID = 'bgk_g04_one_tool';
const MODEL = 'gpt-6-luna';
const REASONING_EFFORT = 'max';
const EPOCH_ID = 'run95-g04-person-activity-codex-current-evidence';
const ARGUMENT_PROFILE = 'fixed-g04-person-13684-voice-tv-12m-48r-16d-8rows-v1';
const REPORT_PATH = path.join(ROOT, 'docs/live-probes/g04-person-activity-run95.json');
const CLAIM_PATH = path.join(
  ROOT,
  gitRepositoryText(ROOT, ['rev-parse', '--git-common-dir']),
  'pariya-agent-state/g04-run95-one-shot-claim.json',
);
const PRIVACY_FIELDS = [
  'authProfile', 'oauthAttempted', 'accountDataRead', 'writesAttempted',
  'qqPipelineTested', 'timClientTested', 'promptStored', 'answerStored',
  'rawResultStored', 'artifactImageBytesStored', 'credentialsStored',
];
const ANSWER_CHECK_FIELDS = [
  'exactQueryArguments', 'exactSingleToolCall', 'structuredResultReadback',
  'targetIdentityAndScope', 'calendarWindowValid', 'successfulOfficialSources',
  'boundedCoverageConsistent', 'sourceRowsValid', 'sourceRowsDistinct',
  'answerShapeValid', 'answerIdentityAndStateMatch', 'observedCountMatches',
  'answerSummaryMatches', 'answerCoverageMatches', 'answerRowsMatch',
  'caveatDisclosurePresent', 'noUnsupportedPositiveClaim',
  'plainJsonWithoutMarkdown', 'boundedAnswerBytes', 'boundedMcpTextView',
];

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function readInput() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function readClaim(input) {
  const claim = JSON.parse(readFileSync(CLAIM_PATH, 'utf8'));
  if (claim?.schemaVersion !== 1 || claim.runNumber !== 95 || claim.frontierId !== 'G04' ||
      claim.epochId !== EPOCH_ID || claim.state !== 'CLAIMED' ||
      claim.sourceRevision !== input.sourceRevision || claim.reviewerId !== input.reviewerId ||
      claim.bundleSha256 !== input.bundleSha256 ||
      claim.expectedArgumentsSha256 !== sha256(canonicalJson(G04_EXPECTED_QUERY_ARGUMENTS))) {
    throw new Error('G04 report does not match the local create-once claim.');
  }
}

function currentCatalogSnapshot(root = ROOT) {
  const catalogBytes = readFileSync(path.join(root, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const tool = catalog.find((entry) => entry?.name === TOOL_NAME);
  if (!tool || tool.auth !== 'none' || tool.risk !== 'read') {
    throw new Error('G04 report requires a current anonymous read-only tool catalog entry.');
  }
  return {
    catalogSha256: sha256(catalogBytes),
    toolDescriptionSha256: sha256(tool.description),
    inputSchemaSha256: sha256(canonicalJson(tool.inputSchema)),
  };
}

function safeSourceOperations(value) {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const allowed = new Set([
    'GET /v0/persons/{person_id}',
    'GET /v0/persons/{person_id}/characters',
    'GET /v0/subjects/{subject_id}',
  ]);
  const selected = value.filter((entry) => allowed.has(entry?.operation));
  if (selected.length !== value.length || selected.some((entry) =>
    !Number.isInteger(entry.attempted) || entry.attempted < 0 ||
    !Number.isInteger(entry.succeeded) || entry.succeeded < 0 ||
    !Number.isInteger(entry.failed) || entry.failed < 0 ||
    entry.succeeded + entry.failed !== entry.attempted)) return null;
  if (new Set(selected.map((entry) => entry.operation)).size !== 3) return null;
  return selected.map((entry) => ({
    operation: entry.operation,
    attempted: entry.attempted,
    succeeded: entry.succeeded,
    failed: entry.failed,
  })).sort((a, b) => a.operation.localeCompare(b.operation));
}

function assertSafeInput(input) {
  if (!isRecord(input) || input.model !== MODEL || input.reasoningEffort !== REASONING_EFFORT ||
      typeof input.codexCliVersion !== 'string' || !/^\d+\.\d+\.\d+$/u.test(input.codexCliVersion) ||
      input.processExitCode !== 0 || input.resultStatus !== 'SUCCESS' ||
      input.eventStreamParsed !== true || JSON.stringify(input.serverToolNames) !== JSON.stringify([TOOL_NAME]) ||
      input.serverToolCount !== 1 || input.codexMcpToolEventCount !== 1 ||
      JSON.stringify(input.mcpServerNames) !== JSON.stringify([SERVER_ID]) ||
      input.nonMcpToolEventCount !== 0 || input.shellToolCallCount !== 0 ||
      input.allowedCallCount !== 1 || input.deniedCallCount !== 0 ||
      !/^[0-9a-f]{40}$/u.test(input.sourceRevision ?? '') ||
      !/^[0-9a-f]{64}$/u.test(input.bundleSha256 ?? '') ||
      !Number.isInteger(input.prNumber) || input.prNumber < 1) {
    throw new Error('G04 probe did not complete exactly one isolated target MCP call.');
  }
  if (!isRecord(input.privacy) || Object.keys(input.privacy).length !== PRIVACY_FIELDS.length ||
      PRIVACY_FIELDS.some((key) => !Object.hasOwn(input.privacy, key)) ||
      input.privacy.authProfile !== 'anonymous' ||
      PRIVACY_FIELDS.filter((key) => key !== 'authProfile').some((key) => input.privacy[key] !== false)) {
    throw new Error('G04 requires a passive anonymous public read-only execution.');
  }
  if (gitRepositoryText(ROOT, ['rev-parse', 'HEAD']) !== input.sourceRevision ||
      gitRepositoryText(ROOT, ['status', '--porcelain']) !== '' ||
      computeMcpBundleSha256(ROOT) !== input.bundleSha256 ||
      readG26McpBundleAttestation(ROOT) !== input.bundleSha256) {
    throw new Error('G04 report must bind to the unchanged exact Candidate and MCP bundle.');
  }
  readClaim(input);
}

export function buildG04AgentMcpReport(
  input,
  { root = ROOT, observedAt = new Date().toISOString(), liveStatus = null } = {},
) {
  const answerResult = verifyG04PersonActivityAnswer(
    input.answer,
    input.queryArguments,
    input.toolOutput,
    input.toolCalls,
    input.toolTextUtf8Bytes,
  );
  if (!answerResult.passed || !answerResult.resultSummary ||
      Object.keys(answerResult.answerChecks).sort().join(',') !== [...ANSWER_CHECK_FIELDS].sort().join(',') ||
      Object.values(answerResult.answerChecks).some((value) => value !== true)) {
    return { passed: false, answerChecks: answerResult.answerChecks };
  }
  if (input.model !== MODEL || input.reasoningEffort !== REASONING_EFFORT ||
      !Number.isInteger(input.processExitCode) || input.processExitCode !== 0 ||
      input.resultStatus !== 'SUCCESS' || input.eventStreamParsed !== true ||
      JSON.stringify(input.serverToolNames) !== JSON.stringify([TOOL_NAME]) || input.serverToolCount !== 1 ||
      input.codexMcpToolEventCount !== 1 || JSON.stringify(input.mcpServerNames) !== JSON.stringify([SERVER_ID]) ||
      input.nonMcpToolEventCount !== 0 || input.shellToolCallCount !== 0 ||
      input.allowedCallCount !== 1 || input.deniedCallCount !== 0) {
    return { passed: false, answerChecks: answerResult.answerChecks };
  }
  const resultSourceOperations = safeSourceOperations(input.toolResultSummary?.sourceOperations);
  if (!resultSourceOperations) return { passed: false, answerChecks: answerResult.answerChecks };
  const rootPath = path.resolve(root);
  const catalog = currentCatalogSnapshot(rootPath);
  const currentStatus = liveStatus ?? JSON.parse(readHarnessStatus(rootPath));
  const epoch = currentStatus?.epoch?.state;
  const sourceRevision = input.sourceRevision;
  const baseSha = epoch?.base_sha;
  const reviewHistory = Array.isArray(epoch?.review_history) ? epoch.review_history : [];
  const latestReview = reviewHistory[reviewHistory.length - 1];
  const reviewerIdPattern = new RegExp(`^gpt-6-luna-max-run95-pr${input.prNumber}-round\\d+$`, 'u');
  const exactPassingReview = latestReview?.candidate_sha === sourceRevision &&
    latestReview?.reviewed_base_sha === baseSha && latestReview?.verdict === 'PASS' &&
    typeof input.reviewerId === 'string' && latestReview?.reviewer_id === input.reviewerId &&
    reviewerIdPattern.test(input.reviewerId);
  if (epoch?.epoch_id !== EPOCH_ID || epoch?.pr_number !== input.prNumber ||
      epoch?.candidate_sha !== sourceRevision || epoch?.state !== 'REVIEW_PASSED' ||
      epoch?.ci?.sha !== sourceRevision || epoch?.ci?.status !== 'SUCCESS' ||
      epoch?.review_pass_sha !== sourceRevision ||
      !exactPassingReview ||
      typeof baseSha !== 'string' || !/^[0-9a-f]{40}$/u.test(baseSha)) {
    return { passed: false, answerChecks: answerResult.answerChecks };
  }
  const report = {
    schemaVersion: 1,
    evidenceKind: 'codex_cli_g04_person_activity_agent_mcp',
    runNumber: 95,
    frontierId: 'G04',
    scenarioId: 'G04',
    epochId: EPOCH_ID,
    profile: 'codex-luna-max-one-tool-v1',
    model: MODEL,
    reasoningEffort: REASONING_EFFORT,
    reviewerId: input.reviewerId,
    codexCliVersion: input.codexCliVersion,
    sourceRevision,
    baseSha,
    prNumber: input.prNumber,
    mcpBundleSha256: input.bundleSha256,
    observedAt,
    toolName: TOOL_NAME,
    argumentProfile: ARGUMENT_PROFILE,
    expectedArgumentsSha256: sha256(canonicalJson(G04_EXPECTED_QUERY_ARGUMENTS)),
    ...catalog,
    serverToolNames: [TOOL_NAME],
    serverToolCount: 1,
    mcpServerNames: [SERVER_ID],
    processExitCode: 0,
    resultStatus: 'SUCCESS',
    eventStreamParsed: true,
    codexMcpToolEventCount: 1,
    nonMcpToolEventCount: 0,
    shellToolCallCount: 0,
    allowedCallCount: 1,
    deniedCallCount: 0,
    answerCheckMethod: G04_ANSWER_CHECK_METHOD,
    answerChecks: answerResult.answerChecks,
    answerCounters: answerResult.answerCounters,
    toolCalls: [{ name: TOOL_NAME, state: 'DONE' }],
    toolTextUtf8Bytes: input.toolTextUtf8Bytes,
    resultSummary: answerResult.resultSummary,
    resultByteLength: answerResult.resultByteLength,
    resultSha256: answerResult.resultSha256,
    answerUtf8Bytes: answerResult.answerUtf8Bytes,
    answerSha256: answerResult.answerSha256,
    sourceOperations: resultSourceOperations,
    privacy: {
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
    },
  };
  return { passed: true, report, answerChecks: answerResult.answerChecks, answerCounters: answerResult.answerCounters, resultSummary: answerResult.resultSummary };
}

function readHarnessStatus(root) {
  const script = path.join(root, 'scripts/agent-harness.mjs');
  const environment = sanitizeGitRepositoryEnvironment();
  for (const key of Object.keys(environment)) {
    if (key === 'GH_TOKEN' || key === 'GITHUB_TOKEN') continue;
    if (/(?:BANGUMI|BGM_|OAUTH|TOKEN|SECRET|CREDENTIAL|API[_-]?KEY)/iu.test(key)) {
      delete environment[key];
    }
  }
  const result = spawnSync(process.execPath, [script, 'status', '--run', '95'], {
    cwd: root, env: environment, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error('Unable to verify live Run 95 Harness state.');
  return result.stdout ?? '';
}

export function writeG04AgentMcpReport(input, { root = ROOT, observedAt = new Date().toISOString() } = {}) {
  assertSafeInput(input);
  if (existsSync(REPORT_PATH)) throw new Error('G04 report already exists; refusing to overwrite or retry.');
  const result = buildG04AgentMcpReport(input, { root, observedAt });
  if (!result.passed || !result.report) return result;
  const relativePath = path.relative(ROOT, REPORT_PATH).split(path.sep).join('/');
  if (root !== ROOT || relativePath !== 'docs/live-probes/g04-person-activity-run95.json') {
    throw new Error('G04 report path is fixed to the canonical acceptance artifact.');
  }
  let descriptor;
  try {
    descriptor = openSync(REPORT_PATH, 'wx', 0o600);
    writeFileSync(descriptor, `${JSON.stringify(result.report, null, 2)}\n`, 'utf8');
    closeSync(descriptor);
  } catch {
    if (descriptor !== undefined) {
      try { closeSync(descriptor); } catch { /* Preserve the report create-new failure. */ }
    }
    throw new Error('G04 report already exists or cannot be safely created.');
  }
  return { passed: true, answerChecks: result.answerChecks, answerCounters: result.answerCounters, resultSummary: result.resultSummary };
}

async function main() {
  try {
    const input = await readInput();
    const output = writeG04AgentMcpReport(input);
    process.stdout.write(`${JSON.stringify(output)}\n`);
    if (!output.passed) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'G04 evidence rejected.'}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main();
