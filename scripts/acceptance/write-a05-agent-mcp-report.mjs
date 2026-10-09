import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  A05_ANSWER_CHECK_METHOD,
  A05_EXPECTED_QUERY_ARGUMENTS,
  A05_FORMULA_ID,
  A05_TARGET_TOOL,
  querySha256,
  verifyA05CollectionShareAnswer,
} from './a05-collection-share-answer-check.mjs';
import { computeMcpBundleSha256, gitRepositoryText } from '../lib/g26-mcp-bundle.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const A05_REPORT_RELATIVE_PATH =
  'docs/live-probes/a05-collection-status-share-agent-mcp-run95.json';
export const A05_SOURCE_REPORT_RELATIVE_PATH =
  'docs/research/run95-a05-collection-completion-source-contract-2026-10-09.md';
export const A05_ONE_SHOT_CLAIM_RELATIVE_PATH =
  '.git/pariya-agent-state/a05-run95-one-shot-claim.json';
export const A05_UPSTREAM_SOURCE_COMMIT = '4223d14057fea5078595e40470f8602d3301abb5';
const MODEL = 'gpt-6-luna';
const REASONING_EFFORT = 'max';
const SERVER_ID = 'bgk_a05_one_tool';
const MAX_INPUT_BYTES = 12 * 1024 * 1024;
const A05_SCRIPT_PATHS = {
  oneToolServer: 'apps/mcp/a05-one-tool-mcp-server.mjs',
  runner: 'scripts/acceptance/run-a05-codex-agent-mcp.mjs',
  answerChecker: 'scripts/acceptance/a05-collection-share-answer-check.mjs',
  reportWriter: 'scripts/acceptance/write-a05-agent-mcp-report.mjs',
};

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function git(root, args) {
  return gitRepositoryText(root, args);
}

function currentScriptHashes(root) {
  return Object.fromEntries(
    Object.entries(A05_SCRIPT_PATHS).map(([key, relativePath]) => [
      key,
      sha256(readFileSync(path.join(root, relativePath))),
    ]),
  );
}

function readOneShotClaim(root, sourceRevision, bundleSha256) {
  const gitCommon = path.resolve(root, git(root, ['rev-parse', '--git-common-dir']));
  const claimPath = path.join(gitCommon, 'pariya-agent-state', 'a05-run95-one-shot-claim.json');
  let claim;
  try {
    claim = JSON.parse(readFileSync(claimPath, 'utf8'));
  } catch {
    throw new Error('A05 report requires the create-once local one-shot claim.');
  }
  if (
    claim?.schemaVersion !== 1 ||
    claim.runNumber !== 95 ||
    claim.frontierId !== 'A05' ||
    claim.state !== 'CLAIMED' ||
    claim.candidateSha !== sourceRevision ||
    claim.bundleSha256 !== bundleSha256 ||
    claim.querySha256 !== querySha256() ||
    canonicalJson(claim.scriptHashes) !== canonicalJson(currentScriptHashes(root))
  ) {
    throw new Error('A05 report Candidate does not match the active one-shot claim.');
  }
}

function currentCandidate(root, input) {
  if (git(root, ['status', '--porcelain'])) {
    throw new Error('A05 report must be bound to a clean exact Candidate revision.');
  }
  const sourceRevision = git(root, ['rev-parse', 'HEAD']);
  if (!/^[0-9a-f]{40}$/u.test(input?.sourceRevision ?? '') || input.sourceRevision !== sourceRevision) {
    throw new Error('A05 report Candidate does not match the current checkout.');
  }
  const bundleSha256 = computeMcpBundleSha256(root);
  if (
    !/^[0-9a-f]{64}$/u.test(input?.bundleSha256 ?? '') ||
    input.bundleSha256 !== bundleSha256
  ) {
    throw new Error('A05 report does not match the exact built MCP bundle.');
  }
  readOneShotClaim(root, sourceRevision, bundleSha256);
  return { sourceRevision, bundleSha256 };
}

function reportableRunShape(input) {
  const privacy = input?.privacy;
  return (
    input?.model === MODEL &&
    input?.reasoningEffort === REASONING_EFFORT &&
    /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/u.test(input?.codexCliVersion ?? '') &&
    input?.processExitCode === 0 &&
    input?.eventStreamParsed === true &&
    input?.resultStatus === 'SUCCESS' &&
    Array.isArray(input?.serverToolNames) &&
    canonicalJson(input.serverToolNames) === canonicalJson([A05_TARGET_TOOL]) &&
    Array.isArray(input?.mcpServerNames) &&
    canonicalJson(input.mcpServerNames) === canonicalJson([SERVER_ID]) &&
    input?.codexMcpToolEventCount === 1 &&
    input?.nonMcpToolEventCount === 0 &&
    input?.shellToolCallCount === 0 &&
    input?.allowedCallCount === 1 &&
    input?.deniedCallCount === 0 &&
    canonicalJson(input?.queryArguments) === canonicalJson(A05_EXPECTED_QUERY_ARGUMENTS) &&
    /^[0-9a-f]{40}$/u.test(input?.sourceRevision ?? '') &&
    /^[0-9a-f]{64}$/u.test(input?.bundleSha256 ?? '') &&
    input?.scriptHashes &&
    Object.keys(A05_SCRIPT_PATHS).every((key) => /^[0-9a-f]{64}$/u.test(input.scriptHashes[key] ?? '')) &&
    Number.isInteger(input?.prNumber) &&
    /^[0-9a-f]{40}$/u.test(input?.baseSha ?? '') &&
    privacy?.authProfile === 'anonymous' &&
    privacy?.oauthAttempted === false &&
    privacy?.accountDataRead === false &&
    privacy?.communityRead === false &&
    privacy?.writesAttempted === false &&
    privacy?.qqPipelineTested === false &&
    privacy?.timClientTested === false &&
    privacy?.promptStored === false &&
    privacy?.answerStored === false &&
    privacy?.rawResultStored === false &&
    privacy?.subjectNamesStored === false &&
    privacy?.subjectIdsStored === false &&
    privacy?.credentialsStored === false
  );
}

export function buildA05AgentMcpReport(input, context) {
  const runShape = reportableRunShape(input);
  const verified = verifyA05CollectionShareAnswer(
    input?.answer,
    input?.queryArguments,
    input?.toolOutput,
    input?.toolCalls,
    input?.toolTextUtf8Bytes,
  );
  if (
    !runShape ||
    !verified.passed ||
    input?.sourceRevision !== context?.sourceRevision ||
    input?.bundleSha256 !== context?.bundleSha256 ||
    canonicalJson(input?.scriptHashes) !== canonicalJson(context?.scriptHashes)
  ) {
    return {
      passed: false,
      checks: {
        reportableRunShape: runShape,
        ...verified.checks,
        reportCandidateMatches: input?.sourceRevision === context?.sourceRevision,
        reportBundleMatches: input?.bundleSha256 === context?.bundleSha256,
        reportScriptHashesMatch: canonicalJson(input?.scriptHashes) === canonicalJson(context?.scriptHashes),
      },
      counters: verified.counters,
    };
  }

  const catalogBytes = context?.catalogBytes;
  const catalog = Array.isArray(context?.catalog) ? context.catalog : null;
  const catalogTool = catalog?.find((item) => item?.name === A05_TARGET_TOOL);
  if (
    !Buffer.isBuffer(catalogBytes) ||
    !/^[0-9a-f]{64}$/u.test(context?.sourceReportSha256 ?? '') ||
    !/^[0-9a-f]{64}$/u.test(context?.formulaSourceSha256 ?? '') ||
    !catalogTool ||
    catalogTool.auth !== 'none' ||
    catalogTool.risk !== 'read'
  ) {
    return {
      passed: false,
      checks: { reportableRunShape: true, ...verified.checks, catalogReadOnlyAnonymousTool: false },
      counters: verified.counters,
    };
  }
  const report = {
    schemaVersion: 1,
    evidenceKind: 'codex_cli_a05_collection_share_agent_mcp',
    runNumber: 95,
    scenarioId: 'A05',
    profile: 'run95-a05-collection-share-agent-mcp-v1',
    frontierId: 'A05',
    sourceRevision: context.sourceRevision,
    mcpBundleSha256: context.bundleSha256,
    scriptHashes: context.scriptHashes,
    prNumber: input.prNumber,
    baseSha: input.baseSha,
    observedAt: context.observedAt,
    model: MODEL,
    reasoningEffort: REASONING_EFFORT,
    codexCliVersion: input.codexCliVersion,
    toolName: A05_TARGET_TOOL,
    argumentProfile: 'fixed-a05-anime-score-eight-collect-share-forty-v1',
    querySha256: querySha256(),
    sourceContract: {
      upstreamRepository: 'bangumi/server',
      upstreamCommit: A05_UPSTREAM_SOURCE_COMMIT,
      reportPath: A05_SOURCE_REPORT_RELATIVE_PATH,
      reportSha256: context.sourceReportSha256,
      formulaId: A05_FORMULA_ID,
      formulaSourceSha256: context.formulaSourceSha256,
    },
    catalogSha256: sha256(catalogBytes),
    toolDescriptionSha256: sha256(catalogTool.description),
    inputSchemaSha256: sha256(canonicalJson(catalogTool.inputSchema)),
    serverToolNames: [A05_TARGET_TOOL],
    mcpServerNames: [SERVER_ID],
    serverToolCount: 1,
    processExitCode: 0,
    eventStreamParsed: true,
    codexMcpToolEventCount: 1,
    nonMcpToolEventCount: 0,
    shellToolCallCount: 0,
    allowedCallCount: 1,
    deniedCallCount: 0,
    resultStatus: 'SUCCESS',
    answerCheckMethod: A05_ANSWER_CHECK_METHOD,
    toolTextUtf8Bytes: input.toolTextUtf8Bytes,
    resultCounters: verified.counters,
    answerChecks: verified.checks,
    privacy: {
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
      subjectNamesStored: false,
      subjectIdsStored: false,
      credentialsStored: false,
    },
    rawAnswerPersisted: false,
    rawToolResultPersisted: false,
    subjectNamesPersisted: false,
    subjectIdsPersisted: false,
  };
  return { passed: true, reportPath: A05_REPORT_RELATIVE_PATH, report };
}

function readInput() {
  const input = readFileSync(0, 'utf8');
  if (!input || Buffer.byteLength(input, 'utf8') > MAX_INPUT_BYTES) {
    throw new Error('A05 report input is empty or exceeds its in-memory bound.');
  }
  return JSON.parse(input);
}

export function writeA05AgentMcpReport(input, root = ROOT) {
  const { sourceRevision, bundleSha256 } = currentCandidate(root, input);
  const scriptHashes = currentScriptHashes(root);
  const catalogBytes = readFileSync(path.join(root, 'docs/tool-catalog.json'));
  const sourceReport = readFileSync(path.join(root, A05_SOURCE_REPORT_RELATIVE_PATH));
  const formulaSource = readFileSync(path.join(root, 'packages/provider-core/src/formulas.ts'));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const result = buildA05AgentMcpReport(input, {
    sourceRevision,
    bundleSha256,
    scriptHashes,
    sourceReportSha256: sha256(sourceReport),
    formulaSourceSha256: sha256(formulaSource),
    catalogBytes,
    catalog,
    observedAt: new Date().toISOString(),
  });
  if (!result.passed) return result;

  const reportPath = path.join(root, A05_REPORT_RELATIVE_PATH);
  if (existsSync(reportPath)) throw new Error('An A05 report already exists; refusing to overwrite it.');
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(result.report, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o644,
    flag: 'wx',
  });
  return {
    passed: true,
    reportPath: A05_REPORT_RELATIVE_PATH,
    counters: result.report.resultCounters,
    answerChecks: result.report.answerChecks,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = writeA05AgentMcpReport(readInput());
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.passed ? 0 : 1;
  } catch {
    process.stderr.write('A05 sanitized report was not written.\n');
    process.exitCode = 1;
  }
}
