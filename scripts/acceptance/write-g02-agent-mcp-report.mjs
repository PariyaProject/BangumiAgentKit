import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  G02_QUERY_ARGUMENTS,
  verifyG02QueryAnswer,
  verifyG02RendererAnswer,
} from './g02-discovery-answer-check.mjs';
import {
  computeMcpBundleSha256,
  gitRepositoryText,
  readG26McpBundleAttestation,
} from '../lib/g26-mcp-bundle.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const G02_EXPECTED_ARGUMENTS_BY_TOOL = {
  'bangumi.query_subjects': G02_QUERY_ARGUMENTS,
  'bangumi.render_query_subjects': G02_QUERY_ARGUMENTS,
};
const ARGUMENT_PROFILES = {
  'bangumi.query_subjects': 'g02-2024-isekai-query-v1',
  'bangumi.render_query_subjects': 'g02-2024-isekai-render-v1',
};
const SERVER_ID = 'bgk_g02_one_tool';
const MODEL = 'gpt-6-luna';
const REASONING_EFFORT = 'max';
const REPORT_PATHS = {
  'bangumi.query_subjects': 'docs/live-probes/pariya-agent-codex-luna-e2e-G02-query.json',
  'bangumi.render_query_subjects': 'docs/live-probes/pariya-agent-codex-luna-e2e-G02-render.json',
};
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
  artifactImageBytesStored: false,
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

function claimPath(root) {
  const commonDir = gitRepositoryText(root, ['rev-parse', '--git-common-dir']);
  if (!commonDir) throw new Error('G02 requires the local one-shot claim directory.');
  return path.join(
    path.resolve(root, commonDir),
    'pariya-agent-state',
    'g02-run95-one-shot-claim.json',
  );
}

function verifyClaim(root, input) {
  let claim;
  try {
    claim = JSON.parse(readFileSync(claimPath(root), 'utf8'));
  } catch {
    throw new Error('G02 report requires the durable create-once claim.');
  }
  const expectedArgumentsSha256 = sha256(canonicalJson(G02_EXPECTED_ARGUMENTS_BY_TOOL));
  if (
    claim?.schemaVersion !== 1 ||
    claim.runNumber !== 95 ||
    claim.frontierId !== 'G02' ||
    claim.epochId !== 'run95-g02-current-agent-mcp' ||
    JSON.stringify(claim.toolNames) !==
      JSON.stringify(Object.keys(G02_EXPECTED_ARGUMENTS_BY_TOOL)) ||
    claim.state !== 'CLAIMED' ||
    claim.sourceRevision !== input.sourceRevision ||
    claim.bundleSha256 !== input.bundleSha256 ||
    claim.baseSha !== input.baseSha ||
    claim.prNumber !== input.prNumber ||
    claim.expectedArgumentsSha256 !== expectedArgumentsSha256 ||
    claim.model !== MODEL ||
    claim.reasoningEffort !== REASONING_EFFORT
  ) {
    throw new Error('G02 Candidate does not match its active one-shot claim.');
  }
}

function currentToolHashes(root, toolName) {
  const catalogBytes = readFileSync(path.join(root, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const tool = catalog.find((item) => item?.name === toolName);
  if (!tool || tool.auth !== 'none' || tool.risk !== 'read') {
    throw new Error('G02 target is not currently catalogued as anonymous and read-only.');
  }
  return {
    catalogSha256: sha256(catalogBytes),
    toolDescriptionSha256: sha256(tool.description),
    inputSchemaSha256: sha256(canonicalJson(tool.inputSchema)),
  };
}

function verifyProbe(probe, shared, root) {
  const toolName = probe?.toolName;
  const expectedArguments = G02_EXPECTED_ARGUMENTS_BY_TOOL[toolName];
  const expectedHash = sha256(canonicalJson(expectedArguments));
  const server = probe?.serverSummary;
  const events = probe?.eventsSummary;
  const completed = events?.completedMcpCalls?.[0];
  const toolHashes = currentToolHashes(root, toolName);
  const eventComplete = probe?.eventStreamParsed === true && events?.eventStreamComplete === true;
  if (
    !expectedArguments ||
    !server ||
    !events ||
    probe?.processExitCode !== 0 ||
    probe?.codexCliVersion !== shared.codexCliVersion ||
    !/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/u.test(probe.codexCliVersion) ||
    !eventComplete ||
    events.codexMcpToolEventCount !== 1 ||
    JSON.stringify(events.mcpServerNames) !== JSON.stringify([SERVER_ID]) ||
    events.nonMcpToolEventCount !== 0 ||
    events.shellToolCallCount !== 0 ||
    events.completedMcpCalls.length !== 1 ||
    completed?.tool !== toolName ||
    canonicalJson(completed?.arguments) !== canonicalJson(expectedArguments) ||
    !Array.isArray(completed?.result?.content) ||
    events.toolCalls?.length !== 1 ||
    events.toolCalls[0]?.name !== toolName ||
    events.toolCalls[0]?.state !== 'DONE' ||
    typeof events.answer !== 'string' ||
    !events.answer.trim() ||
    server.serverProfile !== 'one-tool-anonymous-public-v1' ||
    server.sourceRevision !== shared.sourceRevision ||
    server.bundleSha256 !== shared.bundleSha256 ||
    server.toolName !== toolName ||
    server.serverToolCount !== 1 ||
    JSON.stringify(server.serverToolNames) !== JSON.stringify([toolName]) ||
    server.expectedArgumentsSha256 !== expectedHash ||
    server.argumentMatch !== true ||
    server.allowedCallCount !== 1 ||
    server.deniedCallCount !== 0 ||
    server.serverResultStatus !== 'SUCCESS' ||
    server.catalogSha256 !== toolHashes.catalogSha256 ||
    server.toolDescriptionSha256 !== toolHashes.toolDescriptionSha256 ||
    server.inputSchemaSha256 !== toolHashes.inputSchemaSha256 ||
    !server.privacy ||
    Object.entries(PRIVACY).some(([key, expected]) =>
      key === 'communityRead' ? false : server.privacy[key] !== expected,
    )
  ) {
    throw new Error('G02 probe did not complete its exact isolated one-tool call.');
  }
  if (
    !server.result ||
    server.result.toolName !== toolName ||
    !Number.isInteger(server.result.resultByteLength) ||
    server.result.resultByteLength < 1 ||
    !/^[0-9a-f]{64}$/u.test(server.result.resultSha256 ?? '') ||
    !Array.isArray(server.result.sourceOperations)
  ) {
    throw new Error('G02 result readback summary is incomplete.');
  }
  const answer =
    toolName === 'bangumi.query_subjects'
      ? verifyG02QueryAnswer({
          answer: events.answer,
          queryArguments: completed.arguments,
          toolOutput: completed.result,
        })
      : verifyG02RendererAnswer({
          answer: events.answer,
          queryArguments: completed.arguments,
          toolResultSummary: server.result,
        });
  if (!answer.passed) {
    return { passed: false, toolName, answerChecks: answer.answerChecks };
  }
  return {
    passed: true,
    toolName,
    report: {
      schemaVersion: 1,
      evidenceKind: 'codex_cli_mcp_tool_use',
      runNumber: 95,
      frontierId: 'G02',
      sourceRevision: shared.sourceRevision,
      mcpBundleSha256: shared.bundleSha256,
      prNumber: shared.prNumber,
      baseSha: shared.baseSha,
      observedAt: shared.observedAt,
      codexCliVersion: probe.codexCliVersion,
      catalogSha256: toolHashes.catalogSha256,
      profile: 'codex-luna-max-one-tool-v1',
      model: MODEL,
      reasoningEffort: REASONING_EFFORT,
      toolName,
      toolDescriptionSha256: toolHashes.toolDescriptionSha256,
      inputSchemaSha256: toolHashes.inputSchemaSha256,
      argumentProfile: ARGUMENT_PROFILES[toolName],
      expectedArgumentsSha256: expectedHash,
      serverToolNames: [toolName],
      serverToolCount: 1,
      processExitCode: probe.processExitCode,
      resultStatus: 'SUCCESS',
      resultCount: 1,
      eventStreamParsed: true,
      codexMcpToolEventCount: 1,
      nonMcpToolEventCount: events.nonMcpToolEventCount,
      shellToolCallCount: events.shellToolCallCount,
      allowedCallCount: server.allowedCallCount,
      deniedCallCount: server.deniedCallCount,
      qqPipelineTested: false,
      timClientTested: false,
      privacy: PRIVACY,
      scenarios: [
        {
          id: toolName,
          passed: true,
          exactArgumentsMatched: true,
          oneToolAllowlistVerified: true,
          resultReadbackVerified: true,
          answerCheckPassed: true,
          answerChecks: answer.answerChecks,
          toolCalls: [{ name: toolName, state: 'DONE' }],
          result: server.result,
        },
      ],
      resultCounters:
        toolName === 'bangumi.query_subjects'
          ? answer.resultCounters
          : { resultState: 'artifact_returned', artifactReturned: true },
    },
  };
}

export function writeG02AgentMcpReports(input, root = ROOT) {
  if (
    !input ||
    !/^[0-9a-f]{40}$/u.test(input.sourceRevision ?? '') ||
    !/^[0-9a-f]{64}$/u.test(input.bundleSha256 ?? '') ||
    !Number.isInteger(input.prNumber) ||
    input.prNumber < 1 ||
    !/^[0-9a-f]{40}$/u.test(input.baseSha ?? '') ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(input.observedAt ?? '') ||
    !Array.isArray(input.probes) ||
    input.probes.length < 1 ||
    input.probes.length > 2 ||
    new Set(input.probes.map((probe) => probe?.toolName)).size !== input.probes.length
  ) {
    throw new Error('G02 report input does not match the bounded two-tool profile.');
  }
  if (
    gitRepositoryText(root, ['status', '--porcelain']) ||
    gitRepositoryText(root, ['rev-parse', 'HEAD']) !== input.sourceRevision ||
    computeMcpBundleSha256(root) !== input.bundleSha256 ||
    readG26McpBundleAttestation(root) !== input.bundleSha256
  ) {
    throw new Error('G02 report must bind to a clean exact Candidate and MCP bundle.');
  }
  verifyClaim(root, input);
  const shared = {
    sourceRevision: input.sourceRevision,
    bundleSha256: input.bundleSha256,
    prNumber: input.prNumber,
    baseSha: input.baseSha,
    observedAt: input.observedAt,
    codexCliVersion: input.codexCliVersion,
  };
  const verified = input.probes.map((probe) => verifyProbe(probe, shared, root));
  const failed = verified.find((item) => !item.passed);
  if (failed)
    return { passed: false, toolName: failed.toolName, answerChecks: failed.answerChecks };
  const destinations = verified.map(({ toolName, report }) => ({
    absolutePath: path.join(root, REPORT_PATHS[toolName]),
    relativePath: REPORT_PATHS[toolName],
    report,
  }));
  if (destinations.some(({ absolutePath }) => existsSync(absolutePath))) {
    throw new Error('A G02 report already exists; refusing to overwrite evidence.');
  }
  for (const { absolutePath, report } of destinations) {
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o644,
    });
  }
  return {
    passed: true,
    reports: destinations.map(({ relativePath, report }) => ({
      path: relativePath,
      toolName: report.toolName,
      resultCounters: report.resultCounters,
    })),
  };
}
