import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkD02PublicSearchAnswer,
  D02_EXPECTED_QUERY_ARGUMENTS,
  d02SanitizedSourceSummary,
  extractD02SearchReadback,
} from './d02-public-search-answer-check.mjs';
import { computeMcpBundleSha256, gitRepositoryText } from '../lib/g26-mcp-bundle.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TOOL_NAME = 'bangumi.search_subjects';
const SERVER_ID = 'bgk_d02_one_tool';
const MODEL = 'gpt-6-luna';
const REASONING_EFFORT = 'max';
const CLAIM_RELATIVE_PATH = 'pariya-agent-state/d02-run95-one-shot-claim.json';
const REPORT_RELATIVE_PATH = 'docs/live-probes/pariya-agent-codex-luna-e2e-D02-search-subjects.json';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0);
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function claimPath(root = ROOT) {
  const gitCommonDirectory = gitRepositoryText(root, ['rev-parse', '--git-common-dir']);
  if (!gitCommonDirectory) throw new Error('D02 claim requires a Git common directory.');
  return path.join(path.resolve(root, gitCommonDirectory), CLAIM_RELATIVE_PATH);
}

function readClaim() {
  const claim = JSON.parse(readFileSync(claimPath(), 'utf8'));
  if (
    claim?.schemaVersion !== 1 ||
    claim.runNumber !== 95 ||
    claim.frontierId !== 'D02' ||
    claim.toolName !== TOOL_NAME ||
    claim.state !== 'CLAIMED' ||
    claim.expectedArgumentsSha256 !== sha256(canonicalJson(D02_EXPECTED_QUERY_ARGUMENTS))
  ) {
    throw new Error('D02 report does not match the permanent canonical one-shot claim.');
  }
  return claim;
}

function safeMcpResult(call) {
  const result = call?.result;
  if (!result || result.isError === true) return null;
  return extractD02SearchReadback(result);
}

function catalogIdentity() {
  const bytes = readFileSync(path.join(ROOT, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(bytes.toString('utf8'));
  const tool = catalog.find((item) => item?.name === TOOL_NAME);
  if (!tool || tool.auth !== 'optional' || tool.risk !== 'read') {
    throw new Error('Current search_subjects catalog contract is no longer optional-auth, read-only.');
  }
  return {
    catalogSha256: sha256(bytes),
    toolDescriptionSha256: sha256(tool.description),
    inputSchemaSha256: sha256(canonicalJson(tool.inputSchema)),
  };
}

function validateInput(input) {
  const claim = readClaim();
  if (!input || input.model !== MODEL || input.reasoningEffort !== REASONING_EFFORT) {
    throw new Error('D02 report requires GPT-6 Luna at max reasoning.');
  }
  if (input.runNumber !== 95 || input.frontierId !== 'D02' || input.toolName !== TOOL_NAME) {
    throw new Error('D02 report binding is invalid.');
  }
  if (input.claimId !== claim.claimId || input.prNumber !== claim.prNumber ||
      !Number.isSafeInteger(input.prNumber) || input.prNumber < 1) {
    throw new Error('D02 report requires the exact local claim id and active PR number.');
  }
  if (!/^[0-9a-f]{40}$/u.test(input.candidateSha) || !/^[0-9a-f]{40}$/u.test(input.baseSha)) {
    throw new Error('D02 report requires exact Candidate and Base SHAs.');
  }
  if (!/^[0-9a-f]{64}$/u.test(input.bundleSha256)) throw new Error('D02 bundle SHA is invalid.');
  if (!/^[0-9]+\.[0-9]+\.[0-9]+$/u.test(input.codexCliVersion ?? '')) {
    throw new Error('D02 report requires a recognized Codex CLI version.');
  }
  if (!Array.isArray(input.serverToolNames) || canonicalJson(input.serverToolNames) !== canonicalJson([TOOL_NAME]) ||
      input.serverId !== SERVER_ID || input.serverToolCount !== 1 || input.authMode !== 'anonymous-optional-read' ||
      input.credentialEnvironmentCleared !== true) {
    throw new Error('D02 server summary does not prove the isolated anonymous one-tool profile.');
  }
  if (!Array.isArray(input.toolCalls) || input.toolCalls.length !== 1 ||
      input.toolCalls[0]?.name !== TOOL_NAME || input.toolCalls[0]?.state !== 'DONE' ||
      canonicalJson(input.toolCalls[0]?.arguments) !== canonicalJson(D02_EXPECTED_QUERY_ARGUMENTS)) {
    throw new Error('D02 report requires exactly one completed target call with fixed arguments.');
  }
  const identity = catalogIdentity();
  if (
    input.catalogSha256 !== identity.catalogSha256 ||
    input.toolDescriptionSha256 !== identity.toolDescriptionSha256 ||
    input.inputSchemaSha256 !== identity.inputSchemaSha256
  ) {
    throw new Error('D02 MCP catalog identity changed during the one-shot.');
  }
  if (claim.candidateSha !== input.candidateSha || claim.baseSha !== input.baseSha ||
      claim.bundleSha256 !== input.bundleSha256) {
    throw new Error('D02 one-shot claim does not match the exact Candidate/Base/bundle.');
  }
  const readback = safeMcpResult(input.completedCall);
  if (!readback || readback.mode !== input.readbackMode ||
      readback.textUtf8Bytes !== input.readbackTextUtf8Bytes) {
    throw new Error('D02 requires complete, unclipped structured result readback.');
  }
  const sourceResult = readback.value;
  const serializedSourceResult = JSON.stringify(sourceResult);
  if (
    sha256(serializedSourceResult) !== input.serverResultSha256 ||
    Buffer.byteLength(serializedSourceResult, 'utf8') !== input.serverResultByteLength
  ) {
    throw new Error('D02 structuredContent does not match the one-tool server result digest.');
  }
  if (input.codexExitCode !== 0 || input.eventStreamParsed !== true ||
      input.eventStreamComplete !== true || input.targetMcpCallCount !== 1 ||
      input.nonMcpToolEventCount !== 0 || input.shellToolCallCount !== 0 ||
      canonicalJson(input.nonMcpToolTypes) !== canonicalJson([]) ||
      input.codexErrorItemCount !== 0 || input.serverResultStatus !== 'SUCCESS' ||
      input.allowedCallCount !== 1 || input.deniedCallCount !== 0 || input.argumentMatch !== true ||
      input.bearerTokenInjected !== false || input.sourceRequestCount !== 1 ||
      input.authorizationHeaderSeen !== false || input.sourceRequestValidated !== true ||
      input.serverCandidateSha !== input.candidateSha || input.serverBundleSha256 !== input.bundleSha256 ||
      input.serverProfile !== 'one-tool-anonymous-optional-read-v1') {
    throw new Error('D02 invocation did not satisfy the exact one-call anonymous public gate.');
  }
  if (typeof input.answer !== 'string' ||
      input.answerUtf8Bytes !== Buffer.byteLength(input.answer, 'utf8') ||
      input.answerSha256 !== sha256(input.answer)) {
    throw new Error('D02 answer digest or byte count does not match the temporary response.');
  }
  const answerCheck = checkD02PublicSearchAnswer({
    answer: input.answer,
    sourceResult,
    arguments: input.toolCalls[0].arguments,
  });
  if (!answerCheck.accepted) throw new Error('D02 answer did not satisfy exact row and scope checks.');
  if (gitRepositoryText(ROOT, ['rev-parse', 'HEAD']) !== input.candidateSha ||
      gitRepositoryText(ROOT, ['status', '--porcelain']) !== '' ||
      computeMcpBundleSha256(ROOT) !== input.bundleSha256) {
    throw new Error('D02 Candidate or built runtime changed after the query.');
  }
  return { claim, sourceResult, answerCheck };
}

function writeReport(reportPath, report) {
  const target = path.resolve(ROOT, reportPath);
  if (target !== path.join(ROOT, REPORT_RELATIVE_PATH)) throw new Error('D02 report path is fixed.');
  if (existsSync(target)) throw new Error('D02 report already exists; refusing overwrite or retry.');
  mkdirSync(path.dirname(target), { recursive: true });
  const descriptor = openSync(target, 'wx', 0o600);
  try {
    writeFileSync(descriptor, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  } finally {
    closeSync(descriptor);
  }
}

const REQUIRED_REPORT_KEYS = [
  'schemaVersion', 'evidenceKind', 'runNumber', 'frontierId', 'scenarioId', 'epochId', 'claimId',
  'prNumber', 'toolName', 'argumentProfile', 'expectedArgumentsSha256', 'candidateSha',
  'sourceRevision', 'baseSha', 'bundleSha256', 'ciSha', 'ciStatus', 'reviewerId',
  'catalogSha256', 'toolDescriptionSha256', 'inputSchemaSha256', 'model',
  'reasoningEffort', 'codexCliVersion', 'processExitCode', 'eventStreamParsed',
  'codexMcpToolEventCount', 'codexErrorItemCount', 'mcpServerNames', 'nonMcpToolEventCount',
  'nonMcpToolTypes', 'shellToolCallCount', 'allowedCallCount', 'deniedCallCount', 'authMode',
  'serverId', 'serverProfile', 'resultReadbackMode',
  'resultReadbackTextUtf8Bytes', 'sourceRequestCount',
  'authorizationHeaderSeen', 'sourceRequestValidated', 'bearerTokenInjected', 'serverToolNames',
  'serverResultStatus', 'sourceResultSha256', 'sourceResultByteLength', 'observedAt',
  'source', 'answerChecks', 'answerUtf8Bytes', 'answerSha256', 'privacy', 'acceptanceCredit',
  'limitations',
  'candidate_refresh_reason',
].sort();
const PRIVACY_FIELDS = [
  'authProfile', 'oauthAttempted', 'accountDataRead', 'writesAttempted', 'communityRead',
  'qqPipelineTested', 'timClientTested', 'promptStored', 'answerStored', 'rawResultStored',
  'artifactImageBytesStored', 'credentialsStored',
].sort();
const SOURCE_FIELDS = [
  'api', 'operation', 'resultStatus', 'responseRows', 'returnedCandidates', 'reportedTotal',
  'completeResultReadback', 'rawAnswerPersisted', 'rawToolResultPersisted',
].sort();
const ANSWER_CHECK_KEYS = [
  'accepted', 'argumentsMatch', 'sourceResultValid', 'answerRows', 'matchedRows', 'missingRows',
  'unsupportedClaims', 'scopeLineVerified',
].sort();
const EXPECTED_LIMITATIONS = [
  '仅为固定关键词的实验性公开搜索候选，不代表官方相似度或用户偏好匹配。',
  '来源没有低刺激指标；未判断候选是否适合此偏好。',
  '单次分页结果不完整；未返回不表示不存在。',
  '不包含社区、账号、OAuth、QQ 或 TIM 证据。',
];
const CANDIDATE_REFRESH_REASON =
  'Attach the accepted sanitized D02 search report to the same Epoch and re-establish the exact Candidate.';

function hasExactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    canonicalJson(Object.keys(value).sort()) === canonicalJson(keys);
}

export function validateD02SanitizedReportFile(
  claim,
  reportPath = path.join(ROOT, REPORT_RELATIVE_PATH),
  root = ROOT,
) {
  const target = path.resolve(reportPath);
  const expectedPath = path.join(path.resolve(root), REPORT_RELATIVE_PATH);
  if (target !== expectedPath) {
    return { passed: false, reason: 'D02 report path is not the fixed acceptance artifact.' };
  }
  let bytes;
  let report;
  try {
    bytes = readFileSync(target);
    report = JSON.parse(bytes.toString('utf8'));
  } catch {
    return { passed: false, reason: 'D02 sanitized report is absent or invalid JSON.' };
  }
  const source = report?.source;
  const answerChecks = report?.answerChecks;
  const privacy = report?.privacy;
  const rowsValid = hasExactKeys(source, SOURCE_FIELDS) &&
    Number.isSafeInteger(source?.responseRows) &&
    source.responseRows >= 0 && source.responseRows <= D02_EXPECTED_QUERY_ARGUMENTS.limit &&
    source.returnedCandidates === source.responseRows &&
    (source.reportedTotal === null ||
      (Number.isSafeInteger(source.reportedTotal) && source.reportedTotal >= source.responseRows));
  const reportMatchesClaim =
    report.schemaVersion === 1 &&
    report.evidenceKind === 'codex_cli_d02_search_subjects_agent_mcp' &&
    report.runNumber === 95 &&
    report.frontierId === 'D02' &&
    report.scenarioId === 'D02' &&
    report.epochId === claim?.epochId &&
    report.claimId === claim?.claimId &&
    report.prNumber === claim?.prNumber &&
    report.toolName === TOOL_NAME &&
    report.argumentProfile === claim?.argumentProfile &&
    report.expectedArgumentsSha256 === claim?.expectedArgumentsSha256 &&
    report.candidateSha === claim?.candidateSha &&
    report.sourceRevision === claim?.candidateSha &&
    report.baseSha === claim?.baseSha &&
    report.bundleSha256 === claim?.bundleSha256 &&
    report.ciSha === claim?.candidateSha &&
    report.ciStatus === 'SUCCESS' &&
    report.reviewerId === claim?.reviewerId &&
    /^[0-9a-f]{64}$/u.test(report.catalogSha256 ?? '') &&
    /^[0-9a-f]{64}$/u.test(report.toolDescriptionSha256 ?? '') &&
    /^[0-9a-f]{64}$/u.test(report.inputSchemaSha256 ?? '') &&
    report.model === MODEL &&
    report.reasoningEffort === REASONING_EFFORT &&
    /^\d+\.\d+\.\d+$/u.test(report.codexCliVersion ?? '') &&
    report.processExitCode === 0 &&
    report.eventStreamParsed === true &&
    report.codexMcpToolEventCount === 1 &&
    report.codexErrorItemCount === 0 &&
    canonicalJson(report.mcpServerNames) === canonicalJson([SERVER_ID]) &&
    report.nonMcpToolEventCount === 0 &&
    canonicalJson(report.nonMcpToolTypes) === canonicalJson([]) &&
    report.shellToolCallCount === 0 &&
    report.allowedCallCount === 1 &&
    report.deniedCallCount === 0 &&
    report.authMode === 'anonymous-optional-read; credential environment cleared; MemoryStorage empty' &&
    report.serverId === SERVER_ID &&
    ['structuredContent', 'complete-json-text'].includes(report.resultReadbackMode) &&
    (report.resultReadbackMode === 'structuredContent'
      ? report.resultReadbackTextUtf8Bytes === null
      : Number.isSafeInteger(report.resultReadbackTextUtf8Bytes) &&
        report.resultReadbackTextUtf8Bytes > 0 && report.resultReadbackTextUtf8Bytes <= 3600) &&
    report.serverProfile === 'one-tool-anonymous-optional-read-v1' &&
    report.sourceRequestCount === 1 &&
    report.authorizationHeaderSeen === false &&
    report.sourceRequestValidated === true &&
    report.bearerTokenInjected === false &&
    canonicalJson(report.serverToolNames) === canonicalJson([TOOL_NAME]) &&
    report.serverResultStatus === 'SUCCESS' &&
    /^[0-9a-f]{64}$/u.test(report.sourceResultSha256 ?? '') &&
    Number.isSafeInteger(report.sourceResultByteLength) &&
    report.sourceResultByteLength > 0 && report.sourceResultByteLength <= 1_000_000 &&
    source?.api === 'Bangumi official public v0 (experimental)' &&
    source.operation === 'POST /v0/search/subjects' &&
    ['exact', 'disambiguation', 'not_found'].includes(source.resultStatus) &&
    source.completeResultReadback === true &&
    source.rawAnswerPersisted === false &&
    source.rawToolResultPersisted === false &&
    rowsValid &&
    (source.resultStatus !== 'not_found' || source.responseRows === 0) &&
    hasExactKeys(answerChecks, ANSWER_CHECK_KEYS) &&
    answerChecks.accepted === true && answerChecks.argumentsMatch === true &&
    answerChecks.sourceResultValid === true && answerChecks.answerRows === source.responseRows &&
    answerChecks.matchedRows === source.responseRows && answerChecks.missingRows === 0 &&
    answerChecks.unsupportedClaims === false && answerChecks.scopeLineVerified === true &&
    canonicalJson(report.acceptanceCredit) ===
      canonicalJson({ agentMcpTools: 1, frontierD02: 'PARTIAL' }) &&
    Number.isSafeInteger(report.answerUtf8Bytes) && report.answerUtf8Bytes > 0 &&
    report.answerUtf8Bytes <= 3600 &&
    /^[0-9a-f]{64}$/u.test(report.answerSha256 ?? '') &&
    typeof report.observedAt === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(report.observedAt) &&
    hasExactKeys(privacy, PRIVACY_FIELDS) && privacy.authProfile === 'anonymous' &&
    Object.entries(privacy).every(([key, value]) => key === 'authProfile' || value === false) &&
    canonicalJson(report.limitations) === canonicalJson(EXPECTED_LIMITATIONS) &&
    report.candidate_refresh_reason === CANDIDATE_REFRESH_REASON &&
    hasExactKeys(report, REQUIRED_REPORT_KEYS);
  if (!reportMatchesClaim) {
    return { passed: false, reason: 'D02 report does not match the claimed, sanitized result profile.' };
  }
  return {
    passed: true,
    reportPath: REPORT_RELATIVE_PATH,
    reportSha256: sha256(bytes),
    sourceRows: source.responseRows,
    matchedAnswerRows: answerChecks.matchedRows,
  };
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath || !path.isAbsolute(inputPath)) throw new Error('Pass the absolute temporary D02 summary JSON path.');
  const tempRoot = path.resolve(os.tmpdir()) + path.sep;
  if (!path.resolve(inputPath).startsWith(tempRoot)) throw new Error('D02 raw input must remain under the temporary directory.');
  const input = JSON.parse(readFileSync(inputPath, 'utf8'));
  const { claim, sourceResult, answerCheck } = validateInput(input);
  const source = d02SanitizedSourceSummary(sourceResult);
  const report = {
    schemaVersion: 1,
    evidenceKind: 'codex_cli_d02_search_subjects_agent_mcp',
    runNumber: 95,
    frontierId: 'D02',
    scenarioId: 'D02',
    epochId: claim.epochId,
    claimId: claim.claimId,
    prNumber: input.prNumber,
    toolName: TOOL_NAME,
    argumentProfile: 'fixed-d02-apocalypse-travel-keyword-anime-top8-v1',
    expectedArgumentsSha256: claim.expectedArgumentsSha256,
    candidateSha: input.candidateSha,
    sourceRevision: input.candidateSha,
    baseSha: input.baseSha,
    ciSha: input.candidateSha,
    ciStatus: 'SUCCESS',
    reviewerId: input.reviewerId,
    model: MODEL,
    reasoningEffort: REASONING_EFFORT,
    codexCliVersion: input.codexCliVersion,
    processExitCode: input.codexExitCode,
    eventStreamParsed: input.eventStreamParsed && input.eventStreamComplete,
    codexMcpToolEventCount: input.targetMcpCallCount,
    codexErrorItemCount: input.codexErrorItemCount,
    mcpServerNames: [SERVER_ID],
    nonMcpToolEventCount: input.nonMcpToolEventCount,
    nonMcpToolTypes: input.nonMcpToolTypes,
    shellToolCallCount: input.shellToolCallCount,
    allowedCallCount: input.allowedCallCount,
    deniedCallCount: input.deniedCallCount,
    bundleSha256: input.bundleSha256,
    catalogSha256: input.catalogSha256,
    toolDescriptionSha256: input.toolDescriptionSha256,
    inputSchemaSha256: input.inputSchemaSha256,
    observedAt: new Date().toISOString(),
    authMode: 'anonymous-optional-read; credential environment cleared; MemoryStorage empty',
    serverId: SERVER_ID,
    resultReadbackMode: input.readbackMode,
    resultReadbackTextUtf8Bytes: input.readbackTextUtf8Bytes,
    serverProfile: 'one-tool-anonymous-optional-read-v1',
    sourceRequestCount: input.sourceRequestCount,
    authorizationHeaderSeen: input.authorizationHeaderSeen,
    sourceRequestValidated: input.sourceRequestValidated,
    bearerTokenInjected: input.bearerTokenInjected,
    serverToolNames: [TOOL_NAME],
    serverResultStatus: 'SUCCESS',
    sourceResultSha256: input.serverResultSha256,
    sourceResultByteLength: input.serverResultByteLength,
    source: {
      api: 'Bangumi official public v0 (experimental)',
      operation: 'POST /v0/search/subjects',
      resultStatus: source.status,
      responseRows: source.responseRows,
      returnedCandidates: source.returnedCandidates,
      reportedTotal: source.reportedTotal,
      completeResultReadback: true,
      rawAnswerPersisted: false,
      rawToolResultPersisted: false,
    },
    answerChecks: answerCheck,
    answerUtf8Bytes: input.answerUtf8Bytes,
    answerSha256: input.answerSha256,
    privacy: {
      authProfile: 'anonymous',
      oauthAttempted: false,
      accountDataRead: false,
      writesAttempted: false,
      communityRead: false,
      qqPipelineTested: false,
      timClientTested: false,
      promptStored: false,
      answerStored: false,
      rawResultStored: false,
      artifactImageBytesStored: false,
      credentialsStored: false,
    },
    acceptanceCredit: { agentMcpTools: 1, frontierD02: 'PARTIAL' },
    limitations: [
      '仅为固定关键词的实验性公开搜索候选，不代表官方相似度或用户偏好匹配。',
      '来源没有低刺激指标；未判断候选是否适合此偏好。',
      '单次分页结果不完整；未返回不表示不存在。',
      '不包含社区、账号、OAuth、QQ 或 TIM 证据。',
    ],
    candidate_refresh_reason: CANDIDATE_REFRESH_REASON,
  };
  writeReport(REPORT_RELATIVE_PATH, report);
  process.stdout.write(`${JSON.stringify({
    report: REPORT_RELATIVE_PATH,
    state: 'PASS',
    sourceRows: source.responseRows,
    matchedAnswerRows: answerCheck.matchedRows,
    rawAnswerPersisted: false,
    rawToolResultPersisted: false,
  })}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ state: 'INCONCLUSIVE', error: String(error?.message ?? error) })}\n`);
    process.exitCode = 1;
  }
}
