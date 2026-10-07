import { createHash } from 'node:crypto';
import { mkdirSync, openSync, closeSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { verifyG26ExactTagAnswer } from './g26-exact-tag-answer-check.mjs';
import {
  computeMcpBundleSha256,
  gitRepositoryText,
  readG26McpBundleAttestation,
} from '../lib/g26-mcp-bundle.mjs';

const TOOL_NAME = 'bangumi.query_subjects';
const REPORT_PATH = join(
  process.cwd(),
  'docs',
  'live-probes',
  'g26-exact-tag-agent-mcp-run95.json',
);
const EXPECTED_ARGUMENTS = {
  media: 'anime',
  from: '2019-01-01',
  to: '2025-01-01',
  ratingCount: { min: 10001 },
  tags: ['女性向'],
  categories: 'tv',
  resultMode: 'all',
  limit: 100,
  explain: 'full',
};

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

function readToolCatalog() {
  const bytes = readFileSync(join(process.cwd(), 'docs', 'tool-catalog.json'));
  const catalog = JSON.parse(bytes.toString('utf8'));
  const tool = catalog.find((item) => item?.name === TOOL_NAME);
  if (!tool || tool.auth !== 'none' || tool.risk !== 'read') {
    throw new Error('Current catalog does not classify the G26 target as an anonymous read tool.');
  }
  return {
    catalogSha256: sha256(bytes),
    toolDescriptionSha256: sha256(tool.description),
    inputSchemaSha256: sha256(canonicalJson(tool.inputSchema)),
  };
}

function gitText(args) {
  return gitRepositoryText(process.cwd(), args);
}

function assertSafeInvocation(input) {
  if (input.model !== 'gpt-6-luna' || input.reasoningEffort !== 'max') {
    throw new Error('G26 reports require GPT-6 Luna Max.');
  }
  if (
    typeof input.codexCliVersion !== 'string' ||
    !/^\d+\.\d+\.\d+$/u.test(input.codexCliVersion)
  ) {
    throw new Error('Missing Codex CLI version.');
  }
  if (
    input.processExitCode !== 0 ||
    input.resultStatus !== 'SUCCESS' ||
    input.eventStreamParsed !== true ||
    input.serverToolNames?.length !== 1 ||
    input.serverToolNames[0] !== TOOL_NAME ||
    input.serverToolCount !== 1 ||
    input.codexMcpToolEventCount !== 1 ||
    input.nonMcpToolEventCount !== 0 ||
    input.shellToolCallCount !== 0 ||
    input.allowedCallCount !== 1 ||
    input.deniedCallCount !== 0
  ) {
    throw new Error('G26 probe did not complete exactly one isolated target MCP call.');
  }
  const privacy = input.privacy;
  if (
    !privacy ||
    privacy.authProfile !== 'anonymous' ||
    privacy.oauthAttempted !== false ||
    privacy.accountDataRead !== false ||
    privacy.writesAttempted !== false ||
    privacy.qqPipelineTested !== false ||
    privacy.timClientTested !== false ||
    privacy.credentialsStored !== false
  ) {
    throw new Error('G26 evidence requires a passive anonymous public read-only execution.');
  }
  const dirty = gitText(['status', '--porcelain']);
  if (dirty) throw new Error('G26 evidence must be bound to a clean exact candidate revision.');
  const sourceRevision = gitText(['rev-parse', 'HEAD']);
  if (!/^[0-9a-f]{40}$/u.test(input.sourceRevision) || input.sourceRevision !== sourceRevision) {
    throw new Error('G26 answer evidence Candidate does not match the current checkout.');
  }
  if (
    !/^[0-9a-f]{64}$/u.test(input.bundleSha256) ||
    input.bundleSha256 !== computeMcpBundleSha256(process.cwd()) ||
    input.bundleSha256 !== readG26McpBundleAttestation(process.cwd())
  ) {
    throw new Error('G26 answer evidence does not match the current executed MCP bundle.');
  }
  return { sourceRevision, bundleSha256: input.bundleSha256 };
}

function writeReport(input) {
  const { sourceRevision, bundleSha256 } = assertSafeInvocation(input);
  const check = verifyG26ExactTagAnswer(
    input.answer,
    input.queryArguments,
    input.toolOutput,
    input.toolCalls,
    input.toolTextUtf8Bytes,
  );
  if (check.passed !== true) {
    process.stdout.write(
      `${JSON.stringify({ passed: false, answerChecks: check.answerChecks })}\n`,
    );
    process.exitCode = 1;
    return;
  }
  if (input.queryArguments?.tags?.length !== 1 || input.queryArguments.tags[0] !== '女性向') {
    throw new Error('G26 report writer refuses a query outside its fixed tag scope.');
  }
  const catalog = readToolCatalog();
  const report = {
    schemaVersion: 1,
    evidenceKind: 'codex_cli_g26_exact_tag_agent_mcp',
    runNumber: 95,
    frontierId: 'G26',
    scenarioId: 'G26',
    sourceRevision,
    mcpBundleSha256: bundleSha256,
    observedAt: new Date().toISOString(),
    codexCliVersion: input.codexCliVersion,
    profile: 'codex-luna-max-one-tool-v1',
    model: 'gpt-6-luna',
    reasoningEffort: 'max',
    toolName: TOOL_NAME,
    argumentProfile: 'fixed-g26-exact-public-tag-2019-2024-v1',
    expectedArgumentsSha256: sha256(canonicalJson(EXPECTED_ARGUMENTS)),
    ...catalog,
    processExitCode: 0,
    resultStatus: 'SUCCESS',
    eventStreamParsed: true,
    codexMcpToolEventCount: 1,
    nonMcpToolEventCount: 0,
    shellToolCallCount: 0,
    allowedCallCount: 1,
    deniedCallCount: 0,
    toolCalls: [{ name: TOOL_NAME, state: 'DONE' }],
    answerCheckMethod: check.method,
    answerChecks: check.answerChecks,
    resultCounters: check.resultCounters,
    warningCodes: check.warningCodes,
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
      credentialsStored: false,
    },
  };

  mkdirSync(join(process.cwd(), 'docs', 'live-probes'), { recursive: true });
  let fileDescriptor;
  try {
    fileDescriptor = openSync(REPORT_PATH, 'wx', 0o600);
  } catch {
    throw new Error(
      'A G26 report already exists; the one-shot query must not be repeated or overwritten.',
    );
  }
  try {
    writeFileSync(fileDescriptor, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  } finally {
    closeSync(fileDescriptor);
  }
  process.stdout.write(
    `${JSON.stringify({
      reportPath: REPORT_PATH,
      sourceRevision,
      scenarioId: report.scenarioId,
      passed: check.passed,
      resultCounters: report.resultCounters,
      warningCodes: report.warningCodes,
    })}\n`,
  );
}

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  writeReport(input);
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'G26 evidence report was not written.'}\n`,
  );
  process.exitCode = 1;
}
