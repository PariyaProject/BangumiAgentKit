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
import {
  buildG04RunnerReceiptPayload,
  g04RunnerPublicKeySha256,
  verifyG04RunnerReceipt,
} from './g04-runner-receipt.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TOOL_NAME = 'bangumi.get_person_activity';
const SERVER_ID = 'bgk_g04_one_tool';
const MODEL = 'gpt-6-luna';
const REASONING_EFFORT = 'max';
const EPOCH_ID = 'run95-g04-person-activity-codex-current-evidence';
const ARGUMENT_PROFILE = 'fixed-g04-person-13684-voice-tv-12m-48r-16d-8rows-v1';
const REPORT_PATH = path.join(ROOT, 'docs/live-probes/g04-person-activity-run95.json');
const PRIVACY_FIELDS = [
  'authProfile',
  'oauthAttempted',
  'accountDataRead',
  'writesAttempted',
  'qqPipelineTested',
  'timClientTested',
  'promptStored',
  'answerStored',
  'rawResultStored',
  'artifactImageBytesStored',
  'credentialsStored',
];
const ANSWER_CHECK_FIELDS = [
  'exactQueryArguments',
  'exactSingleToolCall',
  'structuredResultReadback',
  'targetIdentityAndScope',
  'calendarWindowValid',
  'successfulOfficialSources',
  'boundedCoverageConsistent',
  'sourceRowsValid',
  'sourceRowsDistinct',
  'answerShapeValid',
  'answerIdentityAndStateMatch',
  'observedCountMatches',
  'answerSummaryMatches',
  'answerCoverageMatches',
  'answerRowsMatch',
  'caveatDisclosurePresent',
  'noUnsupportedPositiveClaim',
  'plainJsonWithoutMarkdown',
  'boundedAnswerBytes',
  'boundedMcpTextView',
];
const REPORT_FIELDS = [
  'schemaVersion',
  'evidenceKind',
  'runNumber',
  'frontierId',
  'scenarioId',
  'epochId',
  'profile',
  'model',
  'reasoningEffort',
  'reviewerId',
  'claimId',
  'codexCliVersion',
  'sourceRevision',
  'baseSha',
  'prNumber',
  'mcpBundleSha256',
  'runnerEventStreamSha256',
  'runnerServerSummarySha256',
  'runnerReceipt',
  'observedAt',
  'toolName',
  'argumentProfile',
  'expectedArgumentsSha256',
  'catalogSha256',
  'toolDescriptionSha256',
  'inputSchemaSha256',
  'serverToolNames',
  'serverToolCount',
  'mcpServerNames',
  'processExitCode',
  'resultStatus',
  'eventStreamParsed',
  'codexMcpToolEventCount',
  'codexErrorItemCount',
  'nonMcpToolEventCount',
  'shellToolCallCount',
  'allowedCallCount',
  'deniedCallCount',
  'answerCheckMethod',
  'answerChecks',
  'answerCounters',
  'toolCalls',
  'toolTextUtf8Bytes',
  'resultSummary',
  'resultByteLength',
  'resultSha256',
  'answerUtf8Bytes',
  'answerSha256',
  'sourceOperations',
  'privacy',
];

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
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

function localClaimPath(root = ROOT) {
  const absoluteRoot = path.resolve(root);
  const gitCommon = gitRepositoryText(absoluteRoot, ['rev-parse', '--git-common-dir']);
  if (!gitCommon) throw new Error('G04 local claim requires a Git common directory.');
  return path.join(absoluteRoot, gitCommon, 'pariya-agent-state/g04-run95-one-shot-claim.json');
}

function readClaim(input, liveStatus, root = ROOT) {
  const claim = JSON.parse(readFileSync(localClaimPath(root), 'utf8'));
  const disposition = liveStatus?.epoch?.state?.adversarial_preflight?.g04_one_shot_disposition;
  if (
    claim?.schemaVersion !== 1 ||
    claim.runNumber !== 95 ||
    claim.frontierId !== 'G04' ||
    claim.epochId !== EPOCH_ID ||
    claim.state !== 'CLAIMED' ||
    claim.claimId !== input.claimId ||
    claim.sourceRevision !== input.sourceRevision ||
    claim.reviewerId !== input.reviewerId ||
    claim.baseSha !== input.baseSha ||
    claim.prNumber !== input.prNumber ||
    claim.ciSha !== input.sourceRevision ||
    claim.ciStatus !== 'SUCCESS' ||
    claim.model !== MODEL ||
    claim.reasoningEffort !== REASONING_EFFORT ||
    claim.toolName !== TOOL_NAME ||
    claim.argumentProfile !== ARGUMENT_PROFILE ||
    claim.retryAllowed !== false ||
    claim.bundleSha256 !== input.bundleSha256 ||
    claim.expectedArgumentsSha256 !== sha256(canonicalJson(G04_EXPECTED_QUERY_ARGUMENTS)) ||
    claim.runnerReceiptPublicKey !== input.runnerReceiptPublicKey ||
    claim.runnerReceiptPublicKeySha256 !== g04RunnerPublicKeySha256(input.runnerReceiptPublicKey) ||
    !disposition ||
    disposition.state !== 'CLAIMED' ||
    disposition.claimId !== input.claimId ||
    disposition.frontierId !== 'G04' ||
    disposition.epochId !== EPOCH_ID ||
    disposition.runNumber !== 95 ||
    disposition.prNumber !== input.prNumber ||
    disposition.sourceCandidateSha !== input.sourceRevision ||
    disposition.baseSha !== input.baseSha ||
    disposition.ciSha !== input.sourceRevision ||
    disposition.ciStatus !== 'SUCCESS' ||
    disposition.reviewerId !== input.reviewerId ||
    disposition.bundleSha256 !== input.bundleSha256 ||
    disposition.model !== MODEL ||
    disposition.reasoningEffort !== REASONING_EFFORT ||
    disposition.runnerReceiptPublicKey !== input.runnerReceiptPublicKey ||
    disposition.runnerReceiptPublicKeySha256 !== claim.runnerReceiptPublicKeySha256 ||
    disposition.retryAllowed !== false
  ) {
    throw new Error('G04 report does not match the local and durable Harness one-shot claim.');
  }
  return claim;
}

function isG04ReviewerIdentity(reviewerId, prNumber) {
  return (
    Number.isSafeInteger(prNumber) &&
    prNumber > 0 &&
    typeof reviewerId === 'string' &&
    new RegExp('^gpt-6-luna-max-run95-pr' + prNumber + '-round[1-9][0-9]*$', 'u').test(reviewerId)
  );
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
  if (
    selected.length !== value.length ||
    selected.some(
      (entry) =>
        !Number.isInteger(entry.attempted) ||
        entry.attempted < 0 ||
        !Number.isInteger(entry.succeeded) ||
        entry.succeeded < 0 ||
        !Number.isInteger(entry.failed) ||
        entry.failed < 0 ||
        entry.succeeded + entry.failed !== entry.attempted,
    )
  )
    return null;
  if (new Set(selected.map((entry) => entry.operation)).size !== 3) return null;
  return selected
    .map((entry) => ({
      operation: entry.operation,
      attempted: entry.attempted,
      succeeded: entry.succeeded,
      failed: entry.failed,
    }))
    .sort((a, b) => a.operation.localeCompare(b.operation));
}

function assertSafeInput(input, liveStatus, root = ROOT) {
  if (
    !isRecord(input) ||
    typeof input.claimId !== 'string' ||
    !input.claimId ||
    typeof input.runnerReceiptPublicKey !== 'string' ||
    !isRecord(input.runnerReceipt) ||
    !/^[0-9a-f]{64}$/u.test(input.runnerEventStreamSha256 ?? '') ||
    !/^[0-9a-f]{64}$/u.test(input.runnerServerSummarySha256 ?? '') ||
    input.model !== MODEL ||
    input.reasoningEffort !== REASONING_EFFORT ||
    typeof input.codexCliVersion !== 'string' ||
    !/^\d+\.\d+\.\d+$/u.test(input.codexCliVersion) ||
    input.processExitCode !== 0 ||
    input.resultStatus !== 'SUCCESS' ||
    input.eventStreamParsed !== true ||
    JSON.stringify(input.serverToolNames) !== JSON.stringify([TOOL_NAME]) ||
    input.serverToolCount !== 1 ||
    input.codexMcpToolEventCount !== 1 ||
    !Number.isSafeInteger(input.codexErrorItemCount) ||
    input.codexErrorItemCount < 0 ||
    JSON.stringify(input.mcpServerNames) !== JSON.stringify([SERVER_ID]) ||
    input.nonMcpToolEventCount !== 0 ||
    input.shellToolCallCount !== 0 ||
    input.allowedCallCount !== 1 ||
    input.deniedCallCount !== 0 ||
    !/^[0-9a-f]{40}$/u.test(input.sourceRevision ?? '') ||
    !/^[0-9a-f]{40}$/u.test(input.baseSha ?? '') ||
    !/^[0-9a-f]{64}$/u.test(input.bundleSha256 ?? '') ||
    !Number.isSafeInteger(input.prNumber) ||
    input.prNumber < 1 ||
    !isG04ReviewerIdentity(input.reviewerId, input.prNumber)
  ) {
    throw new Error('G04 probe did not complete exactly one isolated target MCP call.');
  }
  if (
    !isRecord(input.privacy) ||
    Object.keys(input.privacy).length !== PRIVACY_FIELDS.length ||
    PRIVACY_FIELDS.some((key) => !Object.hasOwn(input.privacy, key)) ||
    input.privacy.authProfile !== 'anonymous' ||
    PRIVACY_FIELDS.filter((key) => key !== 'authProfile').some(
      (key) => input.privacy[key] !== false,
    )
  ) {
    throw new Error('G04 requires a passive anonymous public read-only execution.');
  }
  if (
    gitRepositoryText(root, ['rev-parse', 'HEAD']) !== input.sourceRevision ||
    gitRepositoryText(root, ['status', '--porcelain']) !== '' ||
    computeMcpBundleSha256(root) !== input.bundleSha256 ||
    readG26McpBundleAttestation(root) !== input.bundleSha256
  ) {
    throw new Error('G04 report must bind to the unchanged exact Candidate and MCP bundle.');
  }
  readClaim(input, liveStatus, root);
}

function receiptMatchesDurableClaim(input, answerResult, disposition) {
  try {
    return (
      typeof disposition?.runnerReceiptPublicKey === 'string' &&
      disposition.runnerReceiptPublicKey === input.runnerReceiptPublicKey &&
      disposition.runnerReceiptPublicKeySha256 ===
        g04RunnerPublicKeySha256(input.runnerReceiptPublicKey) &&
      verifyG04RunnerReceipt(
        input.runnerReceipt,
        disposition.runnerReceiptPublicKey,
        buildG04RunnerReceiptPayload(input, answerResult),
      )
    );
  } catch {
    return false;
  }
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
  if (
    !answerResult.passed ||
    !answerResult.resultSummary ||
    Object.keys(answerResult.answerChecks).sort().join(',') !==
      [...ANSWER_CHECK_FIELDS].sort().join(',') ||
    Object.values(answerResult.answerChecks).some((value) => value !== true)
  ) {
    return { passed: false, answerChecks: answerResult.answerChecks };
  }
  if (
    input.model !== MODEL ||
    input.reasoningEffort !== REASONING_EFFORT ||
    !Number.isInteger(input.processExitCode) ||
    input.processExitCode !== 0 ||
    input.resultStatus !== 'SUCCESS' ||
    input.eventStreamParsed !== true ||
    JSON.stringify(input.serverToolNames) !== JSON.stringify([TOOL_NAME]) ||
    input.serverToolCount !== 1 ||
    input.codexMcpToolEventCount !== 1 ||
    !Number.isSafeInteger(input.codexErrorItemCount) ||
    input.codexErrorItemCount < 0 ||
    JSON.stringify(input.mcpServerNames) !== JSON.stringify([SERVER_ID]) ||
    input.nonMcpToolEventCount !== 0 ||
    input.shellToolCallCount !== 0 ||
    input.allowedCallCount !== 1 ||
    input.deniedCallCount !== 0
  ) {
    return { passed: false, answerChecks: answerResult.answerChecks };
  }
  const resultSourceOperations = safeSourceOperations(input.toolResultSummary?.sourceOperations);
  if (!resultSourceOperations) return { passed: false, answerChecks: answerResult.answerChecks };
  const rootPath = path.resolve(root);
  const catalog = currentCatalogSnapshot(rootPath);
  const currentStatus = liveStatus ?? JSON.parse(readHarnessStatus(rootPath));
  const run = currentStatus?.run?.state;
  const epochView = currentStatus?.epoch;
  const epoch = currentStatus?.epoch?.state;
  const disposition = epoch?.adversarial_preflight?.g04_one_shot_disposition;
  const sourceRevision = input.sourceRevision;
  const baseSha = epoch?.base_sha;
  const reviewHistory = Array.isArray(epoch?.review_history) ? epoch.review_history : [];
  const latestReview = reviewHistory[reviewHistory.length - 1];
  const exactPassingReview =
    latestReview?.candidate_sha === sourceRevision &&
    latestReview?.reviewed_base_sha === baseSha &&
    latestReview?.verdict === 'PASS' &&
    input.reviewerId === latestReview?.reviewer_id &&
    isG04ReviewerIdentity(input.reviewerId, input.prNumber);
  if (
    epoch?.epoch_id !== EPOCH_ID ||
    epoch?.pr_number !== input.prNumber ||
    epochView?.number !== input.prNumber ||
    epochView?.github_state !== 'OPEN' ||
    run?.state !== 'EPOCH_ACTIVE' ||
    run.active_epoch_pr !== input.prNumber ||
    epoch?.candidate_sha !== sourceRevision ||
    epoch?.state !== 'REVIEW_PASSED' ||
    input.baseSha !== baseSha ||
    epoch?.reviewed_base_sha !== baseSha ||
    epoch?.ci?.sha !== sourceRevision ||
    epoch?.ci?.status !== 'SUCCESS' ||
    epoch?.review_pass_sha !== sourceRevision ||
    !exactPassingReview ||
    !disposition ||
    disposition.state !== 'CLAIMED' ||
    disposition.claimId !== input.claimId ||
    disposition.frontierId !== 'G04' ||
    disposition.epochId !== EPOCH_ID ||
    disposition.runNumber !== 95 ||
    disposition.prNumber !== input.prNumber ||
    disposition.sourceCandidateSha !== sourceRevision ||
    disposition.baseSha !== baseSha ||
    disposition.ciSha !== sourceRevision ||
    disposition.ciStatus !== 'SUCCESS' ||
    disposition.reviewerId !== input.reviewerId ||
    disposition.bundleSha256 !== input.bundleSha256 ||
    disposition.model !== MODEL ||
    disposition.reasoningEffort !== REASONING_EFFORT ||
    disposition.toolName !== TOOL_NAME ||
    disposition.argumentProfile !== ARGUMENT_PROFILE ||
    disposition.expectedArgumentsSha256 !== sha256(canonicalJson(G04_EXPECTED_QUERY_ARGUMENTS)) ||
    disposition.retryAllowed !== false ||
    !receiptMatchesDurableClaim(input, answerResult, disposition) ||
    typeof baseSha !== 'string' ||
    !/^[0-9a-f]{40}$/u.test(baseSha)
  ) {
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
    claimId: input.claimId,
    codexCliVersion: input.codexCliVersion,
    sourceRevision,
    baseSha,
    prNumber: input.prNumber,
    mcpBundleSha256: input.bundleSha256,
    runnerEventStreamSha256: input.runnerEventStreamSha256,
    runnerServerSummarySha256: input.runnerServerSummarySha256,
    runnerReceipt: structuredClone(input.runnerReceipt),
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
    codexErrorItemCount: input.codexErrorItemCount,
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
  return {
    passed: true,
    report,
    answerChecks: answerResult.answerChecks,
    answerCounters: answerResult.answerCounters,
    resultSummary: answerResult.resultSummary,
  };
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
    cwd: root,
    env: environment,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 30_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  if (result.error || result.status !== 0)
    throw new Error('Unable to verify live Run 95 Harness state.');
  return result.stdout ?? '';
}

function g04ReceiptPayloadFromReport(report) {
  return {
    schemaVersion: 1,
    kind: 'g04-runner-acceptance-receipt-v1',
    claimId: report.claimId,
    runNumber: report.runNumber,
    frontierId: report.frontierId,
    epochId: report.epochId,
    prNumber: report.prNumber,
    sourceRevision: report.sourceRevision,
    baseSha: report.baseSha,
    ciSha: report.sourceRevision,
    ciStatus: 'SUCCESS',
    reviewerId: report.reviewerId,
    bundleSha256: report.mcpBundleSha256,
    model: report.model,
    reasoningEffort: report.reasoningEffort,
    toolName: report.toolName,
    argumentProfile: report.argumentProfile,
    expectedArgumentsSha256: report.expectedArgumentsSha256,
    codexCliVersion: report.codexCliVersion,
    processExitCode: report.processExitCode,
    resultStatus: report.resultStatus,
    eventStreamParsed: report.eventStreamParsed,
    serverToolNames: report.serverToolNames,
    serverToolCount: report.serverToolCount,
    mcpServerNames: report.mcpServerNames,
    codexMcpToolEventCount: report.codexMcpToolEventCount,
    codexErrorItemCount: report.codexErrorItemCount,
    nonMcpToolEventCount: report.nonMcpToolEventCount,
    nonMcpToolTypes: [],
    shellToolCallCount: report.shellToolCallCount,
    allowedCallCount: report.allowedCallCount,
    deniedCallCount: report.deniedCallCount,
    eventStreamSha256: report.runnerEventStreamSha256,
    serverSummarySha256: report.runnerServerSummarySha256,
    toolArgumentsSha256: sha256(canonicalJson(G04_EXPECTED_QUERY_ARGUMENTS)),
    toolTextUtf8Bytes: report.toolTextUtf8Bytes,
    resultByteLength: report.resultByteLength,
    resultSha256: report.resultSha256,
    answerUtf8Bytes: report.answerUtf8Bytes,
    answerSha256: report.answerSha256,
    answerChecksSha256: sha256(canonicalJson(report.answerChecks)),
    answerCountersSha256: sha256(canonicalJson(report.answerCounters)),
    resultSummarySha256: sha256(canonicalJson(report.resultSummary)),
  };
}

export function validateG04SanitizedReportFile(disposition, root = ROOT, reportPath = REPORT_PATH) {
  const rootPath = path.resolve(root);
  const absoluteReportPath = path.resolve(reportPath);
  const relativePath = path.relative(rootPath, absoluteReportPath).split(path.sep).join('/');
  if (relativePath !== 'docs/live-probes/g04-person-activity-run95.json') {
    return { passed: false, reason: 'G04 report path is not canonical.' };
  }
  let bytes;
  let report;
  try {
    bytes = readFileSync(absoluteReportPath);
    report = JSON.parse(bytes.toString('utf8'));
  } catch {
    return { passed: false, reason: 'G04 sanitized report is missing or malformed.' };
  }
  if (
    !isRecord(report) ||
    canonicalJson(Object.keys(report).sort()) !== canonicalJson([...REPORT_FIELDS].sort()) ||
    report.schemaVersion !== 1 ||
    report.evidenceKind !== 'codex_cli_g04_person_activity_agent_mcp' ||
    report.runNumber !== 95 ||
    report.frontierId !== 'G04' ||
    report.scenarioId !== 'G04' ||
    report.epochId !== EPOCH_ID ||
    report.profile !== 'codex-luna-max-one-tool-v1' ||
    report.model !== MODEL ||
    report.reasoningEffort !== REASONING_EFFORT ||
    report.claimId !== disposition?.claimId ||
    report.prNumber !== disposition?.prNumber ||
    report.sourceRevision !== disposition?.sourceCandidateSha ||
    report.baseSha !== disposition?.baseSha ||
    report.reviewerId !== disposition?.reviewerId ||
    report.mcpBundleSha256 !== disposition?.bundleSha256 ||
    report.argumentProfile !== ARGUMENT_PROFILE ||
    report.toolName !== TOOL_NAME ||
    report.expectedArgumentsSha256 !== sha256(canonicalJson(G04_EXPECTED_QUERY_ARGUMENTS)) ||
    (disposition?.state !== 'CLAIMED' && disposition?.state !== 'REPORT_WRITTEN') ||
    disposition?.retryAllowed !== false ||
    report.processExitCode !== 0 ||
    report.resultStatus !== 'SUCCESS' ||
    report.eventStreamParsed !== true ||
    report.serverToolNames?.length !== 1 ||
    report.serverToolNames[0] !== TOOL_NAME ||
    report.serverToolCount !== 1 ||
    report.mcpServerNames?.length !== 1 ||
    report.mcpServerNames[0] !== SERVER_ID ||
    report.codexMcpToolEventCount !== 1 ||
    !Number.isSafeInteger(report.codexErrorItemCount) ||
    report.codexErrorItemCount < 0 ||
    report.nonMcpToolEventCount !== 0 ||
    report.shellToolCallCount !== 0 ||
    report.allowedCallCount !== 1 ||
    report.deniedCallCount !== 0 ||
    !Number.isSafeInteger(report.resultByteLength) ||
    !/^[0-9a-f]{64}$/u.test(report.resultSha256 ?? '') ||
    !Number.isSafeInteger(report.answerUtf8Bytes) ||
    !/^[0-9a-f]{64}$/u.test(report.answerSha256 ?? '') ||
    !Number.isSafeInteger(report.toolTextUtf8Bytes) ||
    !/^[0-9a-f]{64}$/u.test(report.runnerEventStreamSha256 ?? '') ||
    !/^[0-9a-f]{64}$/u.test(report.runnerServerSummarySha256 ?? '') ||
    !isRecord(report.answerChecks) ||
    Object.keys(report.answerChecks).sort().join(',') !==
      [...ANSWER_CHECK_FIELDS].sort().join(',') ||
    Object.values(report.answerChecks).some((value) => value !== true) ||
    !isRecord(report.privacy) ||
    Object.keys(report.privacy).length !== PRIVACY_FIELDS.length ||
    PRIVACY_FIELDS.some((key) => !Object.hasOwn(report.privacy, key)) ||
    report.privacy.authProfile !== 'anonymous' ||
    PRIVACY_FIELDS.filter((key) => key !== 'authProfile').some(
      (key) => report.privacy[key] !== false,
    )
  ) {
    return { passed: false, reason: 'G04 report fields do not match the durable one-shot claim.' };
  }
  try {
    const currentCatalog = currentCatalogSnapshot(rootPath);
    if (
      report.catalogSha256 !== currentCatalog.catalogSha256 ||
      report.toolDescriptionSha256 !== currentCatalog.toolDescriptionSha256 ||
      report.inputSchemaSha256 !== currentCatalog.inputSchemaSha256 ||
      computeMcpBundleSha256(rootPath) !== report.mcpBundleSha256 ||
      readG26McpBundleAttestation(rootPath) !== report.mcpBundleSha256
    ) {
      return { passed: false, reason: 'G04 report catalog or exact MCP bundle binding is stale.' };
    }
  } catch {
    return { passed: false, reason: 'G04 report source or bundle could not be verified.' };
  }
  const expectedPublicKey = disposition?.runnerReceiptPublicKey;
  if (
    typeof expectedPublicKey !== 'string' ||
    disposition.runnerReceiptPublicKeySha256 !== g04RunnerPublicKeySha256(expectedPublicKey) ||
    report.runnerReceipt?.publicKeyBase64 !== expectedPublicKey ||
    report.runnerReceipt?.publicKeySha256 !== disposition.runnerReceiptPublicKeySha256 ||
    !verifyG04RunnerReceipt(
      report.runnerReceipt,
      expectedPublicKey,
      g04ReceiptPayloadFromReport(report),
    )
  ) {
    return {
      passed: false,
      reason: 'G04 report has no valid receipt from the claimed runner key.',
    };
  }
  return {
    passed: true,
    reportPath: relativePath,
    reportSha256: sha256(bytes),
    report,
  };
}

export function writeG04AgentMcpReport(
  input,
  { root = ROOT, observedAt = new Date().toISOString() } = {},
) {
  const liveStatus = JSON.parse(readHarnessStatus(root));
  assertSafeInput(input, liveStatus, root);
  if (existsSync(REPORT_PATH))
    throw new Error('G04 report already exists; refusing to overwrite or retry.');
  const result = buildG04AgentMcpReport(input, { root, observedAt, liveStatus });
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
      try {
        closeSync(descriptor);
      } catch {
        /* Preserve the report create-new failure. */
      }
    }
    throw new Error('G04 report already exists or cannot be safely created.');
  }
  return {
    passed: true,
    answerChecks: result.answerChecks,
    answerCounters: result.answerCounters,
    resultSummary: result.resultSummary,
    reportSha256: sha256(readFileSync(REPORT_PATH)),
  };
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  void main();
