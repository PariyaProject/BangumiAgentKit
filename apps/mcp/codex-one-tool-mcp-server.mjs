#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  authorizeToolCall,
  canonicalJson,
  claimSingleToolCall,
  filterAllowedTools,
  publicReadOnlyToolAnnotations,
  summarizeToolResult,
} from '../../scripts/lib/codex-one-tool-evidence.mjs';
import { computeMcpBundleSha256 } from '../../scripts/lib/g26-mcp-bundle.mjs';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { HttpClient, toPublicError } from '@bangumi-agent-kit/bangumi-transport';
import { createRuntimeDependenciesWithStorage, ToolRegistry } from '@bangumi-agent-kit/tools';
import { StdioMcpExecutionIdentityProvider } from './dist/identity.js';
import { toMcpTool } from './dist/catalog.js';
import { presentMcpToolResult } from './dist/result-presenter.js';

const PRODUCT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

class MemoryArtifactStore {
  constructor() {
    this.artifacts = new Map();
  }

  async saveArtifact(buffer, mimeType = 'image/png', options = {}) {
    const id = `art_${randomBytes(16).toString('hex')}`;
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 60 * 60 * 1000);
    const copy = Buffer.from(buffer);
    this.artifacts.set(id, {
      id,
      mimeType,
      width: options.width,
      height: options.height,
      createdAt,
      expiresAt,
      buffer: copy,
    });
    return {
      id,
      mimeType,
      ...(options.width === undefined ? {} : { width: options.width }),
      ...(options.height === undefined ? {} : { height: options.height }),
      expiresAt: expiresAt.toISOString(),
    };
  }

  async getArtifact(id) {
    const item = this.artifacts.get(id);
    if (!item) return null;
    return {
      id: item.id,
      mimeType: item.mimeType,
      width: item.width,
      height: item.height,
      filePath: `memory://${item.id}`,
      createdAt: item.createdAt,
      expiresAt: item.expiresAt,
    };
  }

  async resolveFilePath(_id) {
    return null;
  }

  async cleanExpiredArtifacts() {
    return 0;
  }

  summarize(id) {
    const item = this.artifacts.get(id);
    if (!item) return { returned: false, persisted: false };
    return {
      returned: true,
      persisted: false,
      mimeType: item.mimeType,
      width: item.width,
      height: item.height,
      byteLength: item.buffer.length,
      sha256: createHash('sha256').update(item.buffer).digest('hex'),
      pngSignatureValid:
        item.mimeType === 'image/png' &&
        item.buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE),
    };
  }
}

function writeSanitizedSummary(summaryPath, summary, serverInstanceId) {
  if (!summaryPath) return;
  const absolute = path.resolve(summaryPath);
  const temporaryRoot = path.resolve(os.tmpdir()) + path.sep;
  if (!absolute.startsWith(temporaryRoot)) {
    throw new Error('Summary output must stay inside the operating-system temporary directory.');
  }
  const snapshot = { ...summary, serverInstanceId };
  fs.appendFileSync(`${absolute}.events.jsonl`, `${JSON.stringify(snapshot)}\n`, { mode: 0o600 });
  const temporary = `${absolute}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, absolute);
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (
      ![
        '--tool',
        '--arguments-json',
        '--summary-file',
        '--candidate-sha',
        '--bundle-sha256',
      ].includes(key)
    ) {
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
  if (!toolName || !/^bangumi\.[a-z][a-z0-9_]*$/u.test(toolName)) {
    throw new Error('A single exact Bangumi tool name is required.');
  }
  if (!encodedArguments || !summaryPath || !candidateSha || !bundleSha256) {
    throw new Error(
      '--arguments-json, --summary-file, --candidate-sha, and --bundle-sha256 are required.',
    );
  }
  if (!/^[0-9a-f]{40}$/u.test(candidateSha) || !/^[0-9a-f]{64}$/u.test(bundleSha256)) {
    throw new Error('Exact Candidate and built MCP bundle hashes are required.');
  }
  const expectedArguments = JSON.parse(encodedArguments);
  if (
    !expectedArguments ||
    typeof expectedArguments !== 'object' ||
    Array.isArray(expectedArguments)
  ) {
    throw new Error('Fixed arguments must be a JSON object.');
  }
  return { toolName, expectedArguments, summaryPath, candidateSha, bundleSha256 };
}

function runtimeCandidateMatches(sourceRevision, bundleSha256) {
  try {
    const currentRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: PRODUCT_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const status = execFileSync('git', ['status', '--porcelain'], {
      cwd: PRODUCT_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return (
      currentRevision === sourceRevision &&
      status === '' &&
      computeMcpBundleSha256(PRODUCT_ROOT) === bundleSha256
    );
  } catch {
    return false;
  }
}

async function main(argv = process.argv.slice(2)) {
  const config = parseArguments(argv);
  const serverInstanceId = randomUUID();
  for (const key of Object.keys(process.env)) {
    if (/(?:BANGUMI|BGM_|OAUTH|TOKEN|SECRET|CREDENTIAL|API[_-]?KEY)/iu.test(key)) {
      delete process.env[key];
    }
  }

  const catalogBytes = fs.readFileSync(path.join(PRODUCT_ROOT, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const catalogTool = catalog.find((item) => item?.name === config.toolName);
  if (!catalogTool || catalogTool.auth !== 'none' || catalogTool.risk !== 'read') {
    throw new Error(
      'Only catalogued auth=none, risk=read tools may be exposed by this probe server.',
    );
  }
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: PRODUCT_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  const bundleSha256 = computeMcpBundleSha256(PRODUCT_ROOT);
  if (
    sourceRevision !== config.candidateSha ||
    bundleSha256 !== config.bundleSha256 ||
    !runtimeCandidateMatches(sourceRevision, bundleSha256)
  ) {
    throw new Error('G26 MCP server is not running the immutable exact Candidate bundle.');
  }
  const storage = new MemoryStorage();
  const artifactStore = new MemoryArtifactStore();
  const identityProvider = new StdioMcpExecutionIdentityProvider(storage);
  const publicHttpClient = new HttpClient({ baseUrl: 'https://api.bgm.tv', timeoutMs: 10000 });
  const dependencies = createRuntimeDependenciesWithStorage(storage, {
    publicHttpClient,
    artifactStore,
  });
  const registry = new ToolRegistry(dependencies, { profile: 'full', renderTarget: 'chat' });
  const [tool] = filterAllowedTools(registry.getTools(), config.toolName);
  const mcpTool = {
    ...toMcpTool(tool),
    annotations: publicReadOnlyToolAnnotations(tool),
  };
  const descriptionSha256 = createHash('sha256').update(mcpTool.description, 'utf8').digest('hex');
  const inputSchemaSha256 = createHash('sha256')
    .update(canonicalJson(mcpTool.inputSchema), 'utf8')
    .digest('hex');
  const server = new Server(
    { name: 'bangumi-codex-one-tool-qa', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );
  let allowedCalls = 0;
  let deniedCalls = 0;
  let summary = {
    schemaVersion: 1,
    serverProfile: 'one-tool-anonymous-public-v1',
    sourceRevision,
    bundleSha256,
    catalogSha256: createHash('sha256').update(catalogBytes).digest('hex'),
    toolName: config.toolName,
    toolDescriptionSha256: descriptionSha256,
    inputSchemaSha256,
    serverToolNames: [config.toolName],
    serverToolCount: 1,
    expectedArgumentsSha256: createHash('sha256')
      .update(canonicalJson(config.expectedArguments), 'utf8')
      .digest('hex'),
    serverResultStatus: 'NOT_RUN',
    allowedCallCount: 0,
    deniedCallCount: 0,
    argumentMatch: false,
    result: null,
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
  writeSanitizedSummary(config.summaryPath, summary, serverInstanceId);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [mcpTool] }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const call = authorizeToolCall({
      name: request.params.name,
      args: request.params.arguments || {},
      expectedTool: config.toolName,
      expectedArguments: config.expectedArguments,
      completedCalls: allowedCalls,
    });
    if (!call.allowed) {
      deniedCalls += 1;
      summary = { ...summary, deniedCallCount: deniedCalls };
      writeSanitizedSummary(config.summaryPath, summary, serverInstanceId);
      return {
        content: [{ type: 'text', text: `Rejected by one-tool QA server: ${call.code}.` }],
        isError: true,
      };
    }
    if (!claimSingleToolCall(`${path.resolve(config.summaryPath)}.call-claimed`)) {
      deniedCalls += 1;
      summary = { ...summary, deniedCallCount: deniedCalls };
      writeSanitizedSummary(config.summaryPath, summary, serverInstanceId);
      return {
        content: [{ type: 'text', text: 'Rejected by one-tool QA server: CALL_LIMIT_REACHED.' }],
        isError: true,
      };
    }
    if (!runtimeCandidateMatches(sourceRevision, bundleSha256)) {
      deniedCalls += 1;
      summary = { ...summary, deniedCallCount: deniedCalls };
      writeSanitizedSummary(config.summaryPath, summary, serverInstanceId);
      return {
        content: [{ type: 'text', text: 'Rejected by one-tool QA server: CANDIDATE_DRIFT.' }],
        isError: true,
      };
    }
    allowedCalls += 1;
    summary = { ...summary, allowedCallCount: allowedCalls, argumentMatch: true };
    writeSanitizedSummary(config.summaryPath, summary, serverInstanceId);
    try {
      const identity = await identityProvider.resolveContext(request);
      const result = await registry.executeTool(config.toolName, config.expectedArguments, {
        ...identity,
        requestId: `req_${randomUUID()}`,
        confirmationId: undefined,
      });
      if (!runtimeCandidateMatches(sourceRevision, bundleSha256)) {
        summary = {
          ...summary,
          serverResultStatus: 'ERROR',
          errorCode: 'CANDIDATE_DRIFT',
        };
        writeSanitizedSummary(config.summaryPath, summary, serverInstanceId);
        return {
          content: [
            { type: 'text', text: 'G26 result not accepted: Candidate changed during execution.' },
          ],
          isError: true,
        };
      }
      const resultSummary = summarizeToolResult(
        config.toolName,
        result,
        artifactStore.summarize(result?.artifact?.id),
      );
      summary = {
        ...summary,
        serverResultStatus: 'SUCCESS',
        result: resultSummary,
      };
      writeSanitizedSummary(config.summaryPath, summary, serverInstanceId);
      const presentation = presentMcpToolResult(config.toolName, result);
      return {
        content: [{ type: 'text', text: presentation.text }],
        ...(presentation.structuredContent
          ? { structuredContent: presentation.structuredContent }
          : {}),
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
        content: [
          {
            type: 'text',
            text: JSON.stringify({ code: publicError.code, message: publicError.message }),
          },
        ],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  const shutdown = async () => {
    try {
      await server.close();
    } catch {
      /* Continue best-effort cleanup. */
    }
    try {
      await registry.close();
    } catch {
      /* Continue best-effort cleanup. */
    }
    try {
      await storage.close();
    } catch {
      /* Continue best-effort cleanup. */
    }
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(
      `[codex-one-tool-mcp] ${error instanceof Error ? error.message : 'startup error'}`,
    );
    process.exitCode = 1;
  });
}
