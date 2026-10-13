#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { HttpClient, toPublicError } from '@bangumi-agent-kit/bangumi-transport';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { createRuntimeDependenciesWithStorage, ToolRegistry } from '@bangumi-agent-kit/tools';
import { StdioMcpExecutionIdentityProvider } from './dist/identity.js';
import { toMcpTool } from './dist/catalog.js';
import { presentMcpToolResult } from './dist/result-presenter.js';
import { authorizeToolCall, canonicalJson, claimSingleToolCall } from '../../scripts/lib/codex-one-tool-evidence.mjs';
import { checkD02AnonymousSourceRequest } from '../../scripts/lib/d02-source-fence.mjs';
import { projectD02SearchResult } from '../../scripts/acceptance/d02-public-search-answer-check.mjs';
import {
  computeMcpBundleSha256,
  gitRepositoryText,
  readG26McpBundleAttestation,
} from '../../scripts/lib/g26-mcp-bundle.mjs';
import { restrictD02ProcessEnvironment } from '../../scripts/lib/d02-environment.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TOOL_NAME = 'bangumi.search_subjects';
const SERVER_PROFILE = 'one-tool-anonymous-optional-read-v1';
const EXPECTED_ARGUMENTS = Object.freeze({
  query: '末世 旅行',
  type: 'anime',
  sort: 'match',
  nsfw: 'exclude',
  limit: 8,
  offset: 0,
});

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!['--summary-file', '--candidate-sha', '--bundle-sha256', '--auth-mode'].includes(key) ||
        values.has(key) || index + 1 >= argv.length) {
      throw new Error('D02 MCP server accepts only its fixed anonymous mode, summary path, and immutable Candidate hashes.');
    }
    values.set(key, argv[index + 1]);
    index += 1;
  }
  const summaryPath = values.get('--summary-file');
  const candidateSha = values.get('--candidate-sha');
  const bundleSha256 = values.get('--bundle-sha256');
  const authMode = values.get('--auth-mode');
  const temporaryRoot = `${path.resolve(os.tmpdir())}${path.sep}`;
  if (typeof summaryPath !== 'string' || !path.resolve(summaryPath).startsWith(temporaryRoot) ||
      !/^[0-9a-f]{40}$/u.test(candidateSha ?? '') || !/^[0-9a-f]{64}$/u.test(bundleSha256 ?? '') ||
      authMode !== 'anonymous-optional-read') {
    throw new Error('D02 MCP server requires a temporary summary path and exact Candidate/bundle hashes.');
  }
  return { summaryPath: path.resolve(summaryPath), candidateSha, bundleSha256, authMode };
}

function candidateMatches(candidateSha, bundleSha256) {
  try {
    return gitRepositoryText(ROOT, ['rev-parse', 'HEAD']) === candidateSha &&
      gitRepositoryText(ROOT, ['status', '--porcelain']) === '' &&
      computeMcpBundleSha256(ROOT) === bundleSha256 &&
      readG26McpBundleAttestation(ROOT) === bundleSha256;
  } catch {
    return false;
  }
}

function writeSummary(filePath, value) {
  const snapshot = { ...value, updatedAt: new Date().toISOString() };
  const temporary = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  fs.renameSync(temporary, filePath);
}

function catalogIdentity() {
  const bytes = fs.readFileSync(path.join(ROOT, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(bytes.toString('utf8'));
  const tool = catalog.find((item) => item?.name === TOOL_NAME);
  if (!tool || tool.auth !== 'optional' || tool.risk !== 'read') {
    throw new Error('D02 catalog no longer identifies search_subjects as optional-auth read-only.');
  }
  return { bytes, tool };
}

function jsonBody(request) {
  return request.clone().text().then((text) => JSON.parse(text));
}

function createAnonymousFetch() {
  const state = { requests: 0, authorizationHeaderSeen: false, requestValidated: false };
  const fetchFn = async (input, init) => {
    const request = new Request(input, { ...init, redirect: 'error' });
    const url = new URL(request.url);
    state.requests += 1;
    if (request.headers.has('authorization')) {
      state.authorizationHeaderSeen = true;
      throw new Error('D02 anonymous public request must not carry Authorization.');
    }
    const body = await jsonBody(request);
    const sourceCheck = checkD02AnonymousSourceRequest({
      url,
      method: request.method,
      authorizationHeaderPresent: request.headers.has('authorization'),
      body,
      requestCount: state.requests,
    });
    if (!sourceCheck.allowed) throw new Error(sourceCheck.reasonCode);
    state.requestValidated = true;
    return await fetch(request);
  };
  return { fetchFn, state };
}

async function main() {
  const config = parseArgs(process.argv.slice(2));
  const credentialEnvironmentCleared = restrictD02ProcessEnvironment(process.env);
  if (!credentialEnvironmentCleared) {
    throw new Error('D02 MCP server could not verify its allowlisted environment.');
  }
  const identity = catalogIdentity();
  const sourceSha = gitRepositoryText(ROOT, ['rev-parse', 'HEAD']);
  const bundleSha = computeMcpBundleSha256(ROOT);
  if (sourceSha !== config.candidateSha || bundleSha !== config.bundleSha256 ||
      readG26McpBundleAttestation(ROOT) !== bundleSha || !candidateMatches(sourceSha, bundleSha)) {
    throw new Error('D02 server is not running the clean immutable exact Candidate bundle.');
  }

  const storage = new MemoryStorage();
  const identityProvider = new StdioMcpExecutionIdentityProvider(storage);
  const sourceFence = createAnonymousFetch();
  const publicHttpClient = new HttpClient({
    baseUrl: 'https://api.bgm.tv',
    timeoutMs: 10_000,
    fetchFn: sourceFence.fetchFn,
  });
  const dependencies = createRuntimeDependenciesWithStorage(storage, { publicHttpClient });
  const registry = new ToolRegistry(dependencies, { profile: 'full', renderTarget: 'chat' });
  const tool = registry.getTools().find((item) => item?.name === TOOL_NAME);
  if (!tool || tool.auth !== 'optional' || tool.risk !== 'read') {
    throw new Error('D02 runtime tool differs from its optional-auth read-only catalog entry.');
  }
  const mcpTool = {
    ...toMcpTool(tool),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  };
  const server = new Server({ name: 'bangumi-d02-one-tool-qa', version: '1.0.0' }, {
    capabilities: { tools: {} },
  });
  let allowedCalls = 0;
  let deniedCalls = 0;
  let result = null;
  let resultStatus = 'NOT_RUN';
  const summary = {
    schemaVersion: 1,
    serverId: 'bgk_d02_one_tool',
    serverProfile: SERVER_PROFILE,
    authMode: 'anonymous-optional-read',
    credentialEnvironmentCleared,
    bearerTokenInjected: false,
    sourceRevision: sourceSha,
    bundleSha256: bundleSha,
    catalogSha256: sha256(identity.bytes),
    toolName: TOOL_NAME,
    toolDescriptionSha256: sha256(mcpTool.description),
    inputSchemaSha256: sha256(canonicalJson(mcpTool.inputSchema)),
    serverToolNames: [TOOL_NAME],
    serverToolCount: 1,
    expectedArgumentsSha256: sha256(canonicalJson(EXPECTED_ARGUMENTS)),
    serverResultStatus: resultStatus,
    allowedCallCount: 0,
    deniedCallCount: 0,
    argumentMatch: false,
    result: null,
    sourceFence: { requestCount: 0, authorizationHeaderSeen: false, requestValidated: false },
  };
  writeSummary(config.summaryPath, summary);
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [mcpTool] }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const decision = authorizeToolCall({
      name: request.params.name,
      args: request.params.arguments || {},
      expectedTool: TOOL_NAME,
      expectedArguments: EXPECTED_ARGUMENTS,
      completedCalls: allowedCalls,
    });
    if (!decision.allowed || !candidateMatches(sourceSha, bundleSha)) {
      deniedCalls += 1;
      Object.assign(summary, { deniedCallCount: deniedCalls });
      writeSummary(config.summaryPath, summary);
      return { content: [{ type: 'text', text: 'Rejected by D02 one-tool source fence.' }], isError: true };
    }
    if (!claimSingleToolCall(`${config.summaryPath}.call-claimed`)) {
      deniedCalls += 1;
      Object.assign(summary, { deniedCallCount: deniedCalls });
      writeSummary(config.summaryPath, summary);
      return { content: [{ type: 'text', text: 'Rejected by D02 call limit.' }], isError: true };
    }
    allowedCalls += 1;
    Object.assign(summary, { allowedCallCount: allowedCalls, argumentMatch: true });
    writeSummary(config.summaryPath, summary);
    try {
      const identityContext = await identityProvider.resolveContext(request);
      result = await registry.executeTool(TOOL_NAME, EXPECTED_ARGUMENTS, {
        ...identityContext,
        requestId: `req_${randomUUID()}`,
        confirmationId: undefined,
      });
      if (!candidateMatches(sourceSha, bundleSha)) throw new Error('D02 Candidate changed during request.');
      const safeResult = projectD02SearchResult(result);
      resultStatus = 'SUCCESS';
      Object.assign(summary, {
        serverResultStatus: resultStatus,
        result: {
          resultType: safeResult === null ? 'null' : Array.isArray(safeResult) ? 'array' : typeof safeResult,
          resultByteLength: Buffer.byteLength(JSON.stringify(safeResult) ?? 'null', 'utf8'),
          resultSha256: sha256(JSON.stringify(safeResult) ?? 'null'),
        },
        sourceFence: { ...sourceFence.state },
      });
      writeSummary(config.summaryPath, summary);
      const presentation = presentMcpToolResult(TOOL_NAME, safeResult);
      return {
        content: [{ type: 'text', text: presentation.text }],
        structuredContent: safeResult,
      };
    } catch (error) {
      resultStatus = 'ERROR';
      Object.assign(summary, {
        serverResultStatus: resultStatus,
        errorCode: error?.code === 'PUBLIC_API_ERROR' ? 'PUBLIC_API_ERROR' : 'D02_SOURCE_FENCE_OR_TOOL_ERROR',
        sourceFence: { ...sourceFence.state },
      });
      writeSummary(config.summaryPath, summary);
      const publicError = toPublicError(error);
      return { content: [{ type: 'text', text: JSON.stringify({ code: publicError.code, message: publicError.message }) }], isError: true };
    }
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

try {
  await main();
} catch (error) {
  process.stderr.write(`${JSON.stringify({ errorCode: 'D02_SERVER_START_FAILED', message: String(error?.message ?? error) })}\n`);
  process.exitCode = 1;
}
