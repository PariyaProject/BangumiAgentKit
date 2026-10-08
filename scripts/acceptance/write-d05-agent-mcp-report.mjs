import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  D05_EXPECTED_QUERY_ARGUMENTS,
  verifyD05CurrentSeasonAnswer,
} from './d05-current-season-answer-check.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REPORT_PATH = path.join(
  ROOT,
  'docs/live-probes/d05-current-season-multitag-heat-agent-mcp-run95.json',
);
const TARGET_TOOL = 'bangumi.query_subjects';
const SERVER_ID = 'bgk_d05_one_tool';
const MODEL = 'gpt-6-luna';
const REASONING_EFFORT = 'max';
const ARGUMENT_PROFILE = 'fixed-d05-current-season-campus-romance-heat-v1';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function exactArguments(value) {
  return (
    JSON.stringify(canonicalize(value)) ===
    JSON.stringify(canonicalize(D05_EXPECTED_QUERY_ARGUMENTS))
  );
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

function readInput() {
  const input = readFileSync(0, 'utf8');
  if (!input || Buffer.byteLength(input, 'utf8') > 12 * 1024 * 1024) {
    throw new Error('D05 report input is empty or exceeds its in-memory bound.');
  }
  return JSON.parse(input);
}

export function writeD05AgentMcpReport(input) {
  const answer = typeof input?.answer === 'string' ? input.answer : '';
  const toolOutput = input?.toolOutput;
  const toolCalls = input?.toolCalls;
  const reportable =
    input?.model === MODEL &&
    input?.reasoningEffort === REASONING_EFFORT &&
    /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/u.test(input?.codexCliVersion ?? '') &&
    input?.processExitCode === 0 &&
    input?.eventStreamParsed === true &&
    input?.resultStatus === 'SUCCESS' &&
    input?.serverToolNames?.length === 1 &&
    input.serverToolNames[0] === TARGET_TOOL &&
    input?.mcpServerNames?.length === 1 &&
    input.mcpServerNames[0] === SERVER_ID &&
    input?.codexMcpToolEventCount === 1 &&
    input?.nonMcpToolEventCount === 0 &&
    input?.shellToolCallCount === 0 &&
    input?.allowedCallCount === 1 &&
    input?.deniedCallCount === 0 &&
    exactArguments(input?.queryArguments) &&
    /^[0-9a-f]{40}$/u.test(input?.sourceRevision ?? '') &&
    /^[0-9a-f]{64}$/u.test(input?.bundleSha256 ?? '') &&
    Number.isInteger(input?.prNumber) &&
    /^[0-9a-f]{40}$/u.test(input?.baseSha ?? '') &&
    input?.privacy?.authProfile === 'anonymous' &&
    input?.privacy?.oauthAttempted === false &&
    input?.privacy?.accountDataRead === false &&
    input?.privacy?.communityRead === false &&
    input?.privacy?.writesAttempted === false &&
    input?.privacy?.qqPipelineTested === false &&
    input?.privacy?.timClientTested === false &&
    input?.privacy?.promptStored === false &&
    input?.privacy?.answerStored === false &&
    input?.privacy?.rawResultStored === false &&
    input?.privacy?.artifactImageBytesStored === false &&
    input?.privacy?.credentialsStored === false;
  const answerResult = verifyD05CurrentSeasonAnswer(
    answer,
    input?.queryArguments,
    toolOutput,
    toolCalls,
    input?.toolTextUtf8Bytes,
  );
  const answerChecks = answerResult.answerChecks ?? {};
  if (!reportable || !answerResult.passed) {
    return {
      passed: false,
      answerChecks: reportable ? answerChecks : { reportableRunShape: false },
      resultCounters: answerResult.resultCounters ?? null,
      warningCodes: answerResult.warningCodes ?? [],
    };
  }
  if (existsSync(REPORT_PATH))
    throw new Error('A D05 report already exists; refusing to overwrite it.');

  const catalogBytes = readFileSync(path.join(ROOT, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const catalogTool = catalog.find((item) => item?.name === TARGET_TOOL);
  if (!catalogTool || catalogTool.auth !== 'none' || catalogTool.risk !== 'read') {
    throw new Error('D05 report requires the current catalogued anonymous read-only query tool.');
  }

  const report = {
    schemaVersion: 1,
    evidenceKind: 'codex_cli_d05_current_season_agent_mcp',
    runNumber: 95,
    scenarioId: 'D05',
    profile: 'run95-d05-current-season-multitag-heat-agent-mcp-v1',
    frontierId: 'D05',
    sourceRevision: input.sourceRevision,
    mcpBundleSha256: input.bundleSha256,
    prNumber: input.prNumber,
    baseSha: input.baseSha,
    observedAt: new Date().toISOString(),
    model: MODEL,
    reasoningEffort: REASONING_EFFORT,
    codexCliVersion: input.codexCliVersion,
    toolName: TARGET_TOOL,
    argumentProfile: ARGUMENT_PROFILE,
    expectedArgumentsSha256: sha256(JSON.stringify(canonicalize(D05_EXPECTED_QUERY_ARGUMENTS))),
    catalogSha256: sha256(catalogBytes),
    toolDescriptionSha256: sha256(catalogTool.description),
    inputSchemaSha256: sha256(JSON.stringify(canonicalize(catalogTool.inputSchema))),
    serverToolNames: [TARGET_TOOL],
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
    qqPipelineTested: false,
    timClientTested: false,
    toolCalls: [{ name: TARGET_TOOL, state: 'DONE' }],
    answerCheckMethod: answerResult.method,
    toolTextUtf8Bytes: input.toolTextUtf8Bytes,
    resultCounters: answerResult.resultCounters,
    answerChecks,
    warningCodes: answerResult.warningCodes,
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
    rawAnswerPersisted: false,
    rawToolResultPersisted: false,
  };
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o644,
    flag: 'wx',
  });
  return {
    passed: true,
    reportPath: 'docs/live-probes/d05-current-season-multitag-heat-agent-mcp-run95.json',
    report,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = writeD05AgentMcpReport(readInput());
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.passed ? 0 : 1;
  } catch {
    process.stdout.write(`${JSON.stringify({ passed: false, state: 'REPORT_REJECTED' })}\n`);
    process.exitCode = 1;
  }
}
