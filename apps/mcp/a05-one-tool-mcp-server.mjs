#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  authorizeToolCall,
  canonicalJson,
  claimSingleToolCall,
  filterAllowedTools,
  publicReadOnlyToolAnnotations,
} from '../../scripts/lib/codex-one-tool-evidence.mjs';
import {
  A05_EXPECTED_QUERY_ARGUMENTS,
  A05_TARGET_TOOL,
  querySha256,
} from '../../scripts/acceptance/a05-collection-share-answer-check.mjs';
import { computeMcpBundleSha256, gitRepositoryText } from '../../scripts/lib/g26-mcp-bundle.mjs';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { HttpClient, toPublicError } from '@bangumi-agent-kit/bangumi-transport';
import { createRuntimeDependenciesWithStorage, ToolRegistry } from '@bangumi-agent-kit/tools';
import { StdioMcpExecutionIdentityProvider } from './dist/identity.js';
import { toMcpTool } from './dist/catalog.js';
import { presentMcpToolResult } from './dist/result-presenter.js';

const PRODUCT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function git(args) {
  return gitRepositoryText(PRODUCT_ROOT, args);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function writeSanitizedSummary(summaryPath, summary, serverInstanceId) {
  const absolute = path.resolve(summaryPath);
  const temporaryRoot = path.resolve(os.tmpdir()) + path.sep;
  if (!absolute.startsWith(temporaryRoot)) {
    throw new Error('A05 runtime summary must stay in the operating-system temporary directory.');
  }
  const safe = { ...summary, serverInstanceId };
  fs.appendFileSync(`${absolute}.events.jsonl`, `${JSON.stringify(safe)}\n`, { mode: 0o600 });
  const temporary = `${absolute}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(safe, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, absolute);
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!['--tool', '--arguments-json', '--summary-file', '--candidate-sha', '--bundle-sha256'].includes(key)) {
      throw new Error(`Unknown argument: ${key}`);
    }
    if (values.has(key) || index + 1 >= argv.length) throw new Error(`Invalid ${key} argument.`);
    values.set(key, argv[index + 1]);
    index += 1;
  }
  const toolName = values.get('--tool');
  const encodedArguments = values.get('--arguments-json');
  const summaryPath = values.get('--summary-file');
  const candidateSha = values.get('--candidate-sha');
  const bundleSha256 = values.get('--bundle-sha256');
  if (toolName !== A05_TARGET_TOOL || !encodedArguments || !summaryPath || !candidateSha || !bundleSha256) {
    throw new Error('A05 accepts one fixed anonymous read-only discovery tool and exact-Candidate summary inputs.');
  }
  if (
    !/^[0-9a-f]{40}$/u.test(candidateSha) ||
    !/^[0-9a-f]{64}$/u.test(bundleSha256) ||
    canonicalJson(JSON.parse(encodedArguments)) !== canonicalJson(A05_EXPECTED_QUERY_ARGUMENTS)
  ) {
    throw new Error('A05 fixed query or exact runtime hashes do not match.');
  }
  return { summaryPath, candidateSha, bundleSha256 };
}

function runtimeCandidateMatches(sourceRevision, bundleSha256) {
  try {
    return (
      git(['rev-parse', 'HEAD']) === sourceRevision &&
      git(['status', '--porcelain']) === '' &&
      computeMcpBundleSha256(PRODUCT_ROOT) === bundleSha256
    );
  } catch {
    return false;
  }
}

export function summarizeA05Result(result) {
  const items = Array.isArray(result?.items) ? result.items : [];
  const evidence = (item) => item?.evidence?.collectionCompletionRate ?? [];
  const formulaEvidenceRows = items.filter((item) =>
    evidence(item).some((ref) => ref?.formula === 'bangumi.subject.completion.v1'),
  ).length;
  const sourceEvidenceRows = items.filter((item) =>
    evidence(item).some((ref) => ref?.source?.class === 'official_v0'),
  ).length;
  const coverage = result?.coverage ?? {};
  const budget = result?.plan?.budget ?? {};
  const planText = Array.isArray(result?.plan?.limitations) ? result.plan.limitations.join(' ') : '';
  return {
    state: typeof result?.state === 'string' ? result.state : 'unavailable',
    totalKind: typeof coverage.totalKind === 'string' ? coverage.totalKind : 'unknown',
    scanned: Number.isSafeInteger(coverage.scanned) ? coverage.scanned : null,
    pagesScanned: Number.isSafeInteger(coverage.pagesScanned) ? coverage.pagesScanned : null,
    matched: Number.isSafeInteger(coverage.matched) ? coverage.matched : null,
    returned: Number.isSafeInteger(coverage.returned) ? coverage.returned : null,
    unresolvedCandidates: Number.isSafeInteger(coverage.unresolvedCandidates)
      ? coverage.unresolvedCandidates
      : null,
    hydrationsAttempted: Number.isSafeInteger(coverage.hydrationsAttempted)
      ? coverage.hydrationsAttempted
      : null,
    formulaEvidenceRows,
    sourceEvidenceRows,
    budget: {
      maxPages: budget.maxPages ?? null,
      maxCandidates: budget.maxCandidates ?? null,
      maxHydrations: budget.maxHydrations ?? null,
      concurrency: budget.concurrency ?? null,
      maxReturnedItems: budget.maxReturnedItems ?? null,
    },
    limitationsPresent: {
      sampleVerified: /sample-verified/iu.test(planText),
      notOfficial: /not an official API formula/iu.test(planText),
      experimental: /experimental/iu.test(planText),
      estimated: /estimated/iu.test(planText),
      boundedSample: /bounded observed sample/iu.test(planText),
    },
  };
}

async function main(argv = process.argv.slice(2)) {
  const config = parseArguments(argv);
  const serverInstanceId = randomUUID();
  for (const key of Object.keys(process.env)) {
    if (/(?:BANGUMI|BGM_|OAUTH|TOKEN|SECRET|CREDENTIAL|API[_-]?KEY)/iu.test(key)) delete process.env[key];
  }
  const catalogBytes = fs.readFileSync(path.join(PRODUCT_ROOT, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const catalogTool = catalog.find((item) => item?.name === A05_TARGET_TOOL);
  if (!catalogTool || catalogTool.auth !== 'none' || catalogTool.risk !== 'read') {
    throw new Error('A05 exposes only the catalogued auth=none, risk=read query tool.');
  }
  const sourceRevision = git(['rev-parse', 'HEAD']);
  const bundleSha256 = computeMcpBundleSha256(PRODUCT_ROOT);
  if (
    sourceRevision !== config.candidateSha ||
    bundleSha256 !== config.bundleSha256 ||
    !runtimeCandidateMatches(sourceRevision, bundleSha256)
  ) {
    throw new Error('A05 MCP server is not running the exact immutable Candidate bundle.');
  }

  const storage = new MemoryStorage();
  const dependencies = createRuntimeDependenciesWithStorage(storage, {
    publicHttpClient: new HttpClient({ baseUrl: 'https://api.bgm.tv', timeoutMs: 10_000 }),
  });
  const registry = new ToolRegistry(dependencies, { profile: 'full', renderTarget: 'chat' });
  const [tool] = filterAllowedTools(registry.getTools(), A05_TARGET_TOOL);
  const mcpTool = { ...toMcpTool(tool), annotations: publicReadOnlyToolAnnotations(tool) };
  const server = new Server(
    { name: 'bangumi-a05-one-tool-qa', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );
  const identityProvider = new StdioMcpExecutionIdentityProvider(storage);
  let allowedCalls = 0;
  let deniedCalls = 0;
  let summary = {
    schemaVersion: 1,
    serverProfile: 'one-tool-anonymous-public-v1',
    sourceRevision,
    bundleSha256,
    catalogSha256: sha256(catalogBytes),
    toolName: A05_TARGET_TOOL,
    toolDescriptionSha256: sha256(mcpTool.description),
    inputSchemaSha256: sha256(canonicalJson(mcpTool.inputSchema)),
    querySha256: querySha256(),
    oneToolServerSha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
    serverToolNames: [A05_TARGET_TOOL],
    serverToolCount: 1,
    serverResultStatus: 'NOT_RUN',
    allowedCallCount: 0,
    deniedCallCount: 0,
    resultCounters: null,
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
  };
  writeSanitizedSummary(config.summaryPath, summary, serverInstanceId);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [mcpTool] }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const authorization = authorizeToolCall({
      name: request.params.name,
      args: request.params.arguments || {},
      expectedTool: A05_TARGET_TOOL,
      expectedArguments: A05_EXPECTED_QUERY_ARGUMENTS,
      completedCalls: allowedCalls,
    });
    if (!authorization.allowed) {
      deniedCalls += 1;
      summary = { ...summary, deniedCallCount: deniedCalls };
      writeSanitizedSummary(config.summaryPath, summary, serverInstanceId);
      return { content: [{ type: 'text', text: `A05 one-tool request rejected: ${authorization.code}.` }], isError: true };
    }
    if (!claimSingleToolCall(`${path.resolve(config.summaryPath)}.call-claimed`)) {
      deniedCalls += 1;
      summary = { ...summary, deniedCallCount: deniedCalls };
      writeSanitizedSummary(config.summaryPath, summary, serverInstanceId);
      return { content: [{ type: 'text', text: 'A05 one-tool call limit reached.' }], isError: true };
    }
    if (!runtimeCandidateMatches(sourceRevision, bundleSha256)) {
      deniedCalls += 1;
      summary = { ...summary, deniedCallCount: deniedCalls };
      writeSanitizedSummary(config.summaryPath, summary, serverInstanceId);
      return { content: [{ type: 'text', text: 'A05 Candidate drift detected.' }], isError: true };
    }

    allowedCalls += 1;
    summary = { ...summary, allowedCallCount: allowedCalls };
    writeSanitizedSummary(config.summaryPath, summary, serverInstanceId);
    try {
      const identity = await identityProvider.resolveContext(request);
      const result = await registry.executeTool(A05_TARGET_TOOL, A05_EXPECTED_QUERY_ARGUMENTS, {
        ...identity,
        requestId: `req_${randomUUID()}`,
        confirmationId: undefined,
      });
      if (!runtimeCandidateMatches(sourceRevision, bundleSha256)) {
        summary = { ...summary, serverResultStatus: 'ERROR', errorCode: 'CANDIDATE_DRIFT' };
        writeSanitizedSummary(config.summaryPath, summary, serverInstanceId);
        return { content: [{ type: 'text', text: 'A05 result rejected because the Candidate changed.' }], isError: true };
      }
      summary = {
        ...summary,
        serverResultStatus: 'SUCCESS',
        resultCounters: summarizeA05Result(result),
      };
      writeSanitizedSummary(config.summaryPath, summary, serverInstanceId);
      const presentation = presentMcpToolResult(A05_TARGET_TOOL, result);
      return {
        content: [{ type: 'text', text: presentation.text }],
        ...(presentation.structuredContent ? { structuredContent: presentation.structuredContent } : {}),
      };
    } catch (error) {
      const publicError = toPublicError(error);
      summary = {
        ...summary,
        serverResultStatus: 'ERROR',
        errorCode: typeof publicError.code === 'string' ? publicError.code : 'UNKNOWN_ERROR',
      };
      writeSanitizedSummary(config.summaryPath, summary, serverInstanceId);
      return {
        content: [{ type: 'text', text: JSON.stringify({ code: publicError.code, message: publicError.message }) }],
        isError: true,
      };
    }
  });

  await server.connect(new StdioServerTransport());
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    process.stderr.write('A05 one-tool MCP server could not start.\n');
    process.exitCode = 1;
  });
}
