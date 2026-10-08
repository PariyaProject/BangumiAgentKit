import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitRepositoryText } from '../lib/g26-mcp-bundle.mjs';
import { computeMcpBundleSha256, readS03McpBundleAttestation } from '../lib/s03-mcp-bundle.mjs';
import {
  s03EventEvidenceSha256,
  s03ServerSummarySha256,
  verifyS03ReportClaim,
} from '../lib/s03-one-shot-authorization.mjs';
import {
  S03_ANSWER_CHECK_METHOD,
  S03_EXPECTED_QUERY_ARGUMENTS,
  verifyS03VoiceActorOverlapAnswer,
} from './s03-agent-answer-check.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const S03_REPORT_RELATIVE_PATH =
  'docs/live-probes/s03-series-voice-overlap-agent-mcp-run95.json';
export const S03_REPORT_PATH = path.join(ROOT, S03_REPORT_RELATIVE_PATH);
const TOOL_NAME = 'bangumi.get_series_watch_order';
const SERVER_ID = 'bgk_s03_one_tool';
const MODEL = 'gpt-6-luna';
const REASONING_EFFORT = 'max';
const PRIVACY = {
  authProfile: 'anonymous',
  oauthAttempted: false,
  accountDataRead: false,
  communityRead: false,
  writesAttempted: false,
  qqPipelineTested: false,
  timClientTested: false,
  promptStored: false,
  answerStored: false,
  rawResultStored: false,
  credentialsStored: false,
};

const canonicalJson = (value) =>
  Array.isArray(value)
    ? `[${value.map(canonicalJson).join(',')}]`
    : value && typeof value === 'object'
      ? `{${Object.keys(value)
          .sort()
          .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
          .join(',')}}`
      : JSON.stringify(value);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function git(root, args) {
  return gitRepositoryText(root, args);
}

function assertClaim(input, root, sourceRevision, bundleSha256) {
  if (typeof input?.claimPath !== 'string' || !path.isAbsolute(input.claimPath)) {
    throw new Error('S03 report requires the local create-once claim path.');
  }
  const claimPath = path.resolve(input.claimPath);
  const claim = verifyS03ReportClaim(claimPath, input.authorizationToken);
  if (
    claim.sourceRevision !== sourceRevision ||
    claim.bundleSha256 !== bundleSha256 ||
    claim.expectedArgumentsSha256 !== sha256(canonicalJson(S03_EXPECTED_QUERY_ARGUMENTS)) ||
    claim.baseSha !== input.baseSha ||
    claim.reviewerId !== input.reviewerId
  ) {
    throw new Error('S03 report Candidate does not match the authenticated one-shot claim.');
  }
  const commonDirectory = path.resolve(root, git(root, ['rev-parse', '--git-common-dir']));
  const claimDirectory = path.dirname(claimPath);
  if (
    claimDirectory !== path.join(commonDirectory, 'pariya-agent-state') &&
    !(
      path.basename(claimDirectory) === 'pariya-agent-state' &&
      path.basename(path.dirname(claimDirectory)) === '.git'
    )
  ) {
    throw new Error('S03 claim path is outside local .git/pariya-agent-state.');
  }
  const authorization = claim.reportAuthorization;
  if (
    authorization?.sourceRevision !== sourceRevision ||
    authorization?.baseSha !== input.baseSha ||
    authorization?.bundleSha256 !== bundleSha256 ||
    authorization?.prNumber !== input.prNumber ||
    authorization?.reviewerId !== input.reviewerId ||
    authorization?.model !== input.model ||
    authorization?.reasoningEffort !== input.reasoningEffort ||
    authorization?.codexCliVersion !== input.codexCliVersion ||
    authorization?.processExitCode !== input.processExitCode ||
    authorization?.eventStreamParsed !== input.eventStreamParsed ||
    authorization?.toolTextUtf8Bytes !== input.toolTextUtf8Bytes ||
    authorization?.serverSummarySha256 !== s03ServerSummarySha256(input.serverSummary) ||
    authorization?.eventsSha256 !==
      s03EventEvidenceSha256({
        eventsSummary: input.eventsSummary,
        queryArguments: input.queryArguments,
        toolOutput: input.toolOutput,
        answer: input.answer,
        toolTextUtf8Bytes: input.toolTextUtf8Bytes,
      })
  ) {
    throw new Error('S03 report input does not match the runner-authenticated evidence digest.');
  }
}

export function assertS03ReportCandidate(input, root = ROOT) {
  if (git(root, ['status', '--porcelain'])) {
    throw new Error('S03 report must be bound to a clean exact Candidate revision.');
  }
  const sourceRevision = git(root, ['rev-parse', 'HEAD']);
  if (
    !/^[0-9a-f]{40}$/u.test(input?.sourceRevision ?? '') ||
    input.sourceRevision !== sourceRevision
  ) {
    throw new Error('S03 report Candidate does not match the current checkout.');
  }
  const bundleSha256 = computeMcpBundleSha256(root);
  if (
    !/^[0-9a-f]{64}$/u.test(input?.bundleSha256 ?? '') ||
    input.bundleSha256 !== bundleSha256 ||
    readS03McpBundleAttestation(root) !== bundleSha256
  ) {
    throw new Error('S03 report does not match the exact attested MCP bundle.');
  }
  assertClaim(input, root, sourceRevision, bundleSha256);
  return { sourceRevision, bundleSha256 };
}

export function writeS03AgentMcpReport(input, root = ROOT) {
  const { sourceRevision, bundleSha256 } = assertS03ReportCandidate(input, root);
  const eventsSummary = input?.eventsSummary;
  const completedCall = eventsSummary?.completedMcpCalls?.[0];
  const serverSummary = input?.serverSummary;
  const catalogBytes = readFileSync(path.join(root, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const catalogTool = catalog.find((item) => item?.name === TOOL_NAME);
  const serverSummaryMatchesCatalog = Boolean(
    catalogTool &&
    catalogTool.auth === 'none' &&
    catalogTool.risk === 'read' &&
    serverSummary?.catalogSha256 === sha256(catalogBytes) &&
    serverSummary?.toolDescriptionSha256 === sha256(catalogTool.description) &&
    serverSummary?.inputSchemaSha256 === sha256(canonicalJson(catalogTool.inputSchema)) &&
    serverSummary?.expectedArgumentsSha256 === sha256(canonicalJson(S03_EXPECTED_QUERY_ARGUMENTS)),
  );
  const reportable =
    input?.model === MODEL &&
    input?.reasoningEffort === REASONING_EFFORT &&
    /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/u.test(input?.codexCliVersion ?? '') &&
    input?.processExitCode === 0 &&
    input?.eventStreamParsed === true &&
    Number.isInteger(input?.prNumber) &&
    input.prNumber > 0 &&
    /^[0-9a-f]{40}$/u.test(input?.baseSha ?? '') &&
    input?.resultStatus === 'SUCCESS' &&
    eventsSummary?.codexMcpToolEventCount === 1 &&
    eventsSummary?.mcpServerNames?.length === 1 &&
    eventsSummary.mcpServerNames[0] === SERVER_ID &&
    eventsSummary?.nonMcpToolEventCount === 0 &&
    eventsSummary?.shellToolCallCount === 0 &&
    eventsSummary?.toolCalls?.length === 1 &&
    eventsSummary.toolCalls[0]?.name === TOOL_NAME &&
    eventsSummary.toolCalls[0]?.state === 'DONE' &&
    completedCall?.tool === TOOL_NAME &&
    canonicalJson(completedCall?.arguments) === canonicalJson(S03_EXPECTED_QUERY_ARGUMENTS) &&
    serverSummary?.serverProfile === 's03-one-tool-anonymous-public-v1' &&
    serverSummary?.sourceRevision === sourceRevision &&
    serverSummary?.bundleSha256 === bundleSha256 &&
    serverSummary?.serverToolNames?.length === 1 &&
    serverSummary.serverToolNames[0] === TOOL_NAME &&
    serverSummary?.serverToolCount === 1 &&
    serverSummary?.allowedCallCount === 1 &&
    serverSummary?.deniedCallCount === 0 &&
    serverSummary?.argumentMatch === true &&
    serverSummary?.serverResultStatus === 'SUCCESS' &&
    serverSummaryMatchesCatalog &&
    serverSummary?.result?.subjectId === S03_EXPECTED_QUERY_ARGUMENTS.subjectId &&
    serverSummary?.result?.voiceActorPresence?.personId ===
      S03_EXPECTED_QUERY_ARGUMENTS.voiceActorPersonId &&
    serverSummary?.result?.voiceActorPresence?.matchStatus === 'multi_work_found' &&
    serverSummary?.privacy?.authProfile === 'anonymous' &&
    Object.entries(serverSummary?.privacy ?? {}).every(
      ([key, value]) => key === 'authProfile' || value === false,
    );
  const answerResult = verifyS03VoiceActorOverlapAnswer(
    input?.answer,
    input?.queryArguments,
    input?.toolOutput,
    eventsSummary?.toolCalls,
  );
  const answerChecks = answerResult.answerChecks ?? {};
  const reportPath = path.join(root, S03_REPORT_RELATIVE_PATH);
  if (!reportable || !answerResult.passed) {
    return {
      passed: false,
      answerChecks: reportable ? answerChecks : { reportableRunShape: false },
      resultCounters: answerResult.resultCounters ?? null,
      warningCodes: answerResult.warningCodes ?? [],
    };
  }
  if (existsSync(reportPath))
    throw new Error('A S03 report already exists; refusing to overwrite it.');

  const report = {
    schemaVersion: 1,
    evidenceKind: 'codex_cli_s03_series_voice_overlap_agent_mcp',
    runNumber: 95,
    scenarioId: 'S03',
    profile: 'run95-s03-series-voice-overlap-agent-mcp-v1',
    frontierId: 'S03',
    sourceRevision,
    mcpBundleSha256: bundleSha256,
    prNumber: input.prNumber,
    baseSha: input.baseSha,
    observedAt: new Date().toISOString(),
    model: MODEL,
    reasoningEffort: REASONING_EFFORT,
    codexCliVersion: input.codexCliVersion,
    toolName: TOOL_NAME,
    argumentProfile: 'fixed-s03-spy-family-goto-hiroki-voice-overlap-v1',
    expectedArgumentsSha256: sha256(canonicalJson(S03_EXPECTED_QUERY_ARGUMENTS)),
    catalogSha256: sha256(catalogBytes),
    toolDescriptionSha256: sha256(catalogTool.description),
    inputSchemaSha256: sha256(canonicalJson(catalogTool.inputSchema)),
    serverToolNames: [TOOL_NAME],
    mcpServerNames: [SERVER_ID],
    serverToolCount: 1,
    processExitCode: 0,
    resultCount: 1,
    eventStreamParsed: true,
    codexMcpToolEventCount: 1,
    nonMcpToolEventCount: 0,
    shellToolCallCount: 0,
    allowedCallCount: 1,
    deniedCallCount: 0,
    resultStatus: 'SUCCESS',
    toolCalls: [{ name: TOOL_NAME, state: 'DONE' }],
    answerCheckMethod: S03_ANSWER_CHECK_METHOD,
    toolTextUtf8Bytes: input.toolTextUtf8Bytes,
    answerChecks,
    resultCounters: answerResult.resultCounters,
    resultSummary: answerResult.resultSummary,
    privacy: PRIVACY,
    rawAnswerPersisted: false,
    rawToolResultPersisted: false,
  };
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o644,
    flag: 'wx',
  });
  return { passed: true, reportPath: S03_REPORT_RELATIVE_PATH, report };
}
