#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createRuntimeDependenciesWithStorage, ToolRegistry } from '@bangumi-agent-kit/tools';
import {
  computeMcpBundleSha256,
  gitRepositoryText,
  readG26McpBundleAttestation,
} from '../../scripts/lib/g26-mcp-bundle.mjs';
import { canonicalJson } from '../../scripts/lib/codex-one-tool-evidence.mjs';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  assertM07ManageIndexUnboundProfile,
  M07_MANAGE_INDEX_EXPECTED_ARGUMENTS,
  M07_MANAGE_INDEX_PROFILE_ID,
  M07_MANAGE_INDEX_TOOL,
  sameArguments,
} from '../../scripts/lib/m07-manage-index-unbound-profile.mjs';

const PRODUCT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TEST_ONLY_SECRET = 'run95-m07-local-test-key-0123456789abcdef';
const FIXTURE_CONTEXT = Object.freeze({
  principalId: 'run95-m07-unbound-principal',
  botInstanceId: 'run95-m07-local-mcp',
  conversationId: 'run95-m07-auth-gate',
});

function safeEnvironment() {
  for (const key of Object.keys(process.env)) {
    if (/(?:BANGUMI|BGM_|OAUTH|TOKEN|SECRET|CREDENTIAL|API[_-]?KEY)/iu.test(key)) {
      delete process.env[key];
    }
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function parseM07Arguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (
      ![
        '--profile-id',
        '--arguments-json',
        '--summary-file',
        '--candidate-sha',
        '--bundle-sha256',
      ].includes(key)
    ) {
      throw new Error('M07 server received an unsupported argument.');
    }
    if (values.has(key) || index + 1 >= argv.length)
      throw new Error('M07 server arguments are invalid.');
    values.set(key, argv[index + 1]);
    index += 1;
  }

  const profileId = values.get('--profile-id');
  const argumentJson = values.get('--arguments-json');
  const summaryPath = values.get('--summary-file');
  const candidateSha = values.get('--candidate-sha');
  const bundleSha256 = values.get('--bundle-sha256');
  if (!profileId || !argumentJson || !summaryPath || !candidateSha || !bundleSha256) {
    throw new Error(
      'M07 server requires the exact profile, arguments, summary path, and Candidate hashes.',
    );
  }

  let expectedArguments;
  try {
    expectedArguments = JSON.parse(argumentJson);
  } catch {
    throw new Error('M07 fixed arguments are invalid JSON.');
  }
  const absoluteSummaryPath = path.resolve(summaryPath);
  if (!absoluteSummaryPath.startsWith(path.resolve(os.tmpdir()) + path.sep)) {
    throw new Error('M07 summary output must remain in the operating-system temp directory.');
  }
  if (!/^[0-9a-f]{40}$/u.test(candidateSha) || !/^[0-9a-f]{64}$/u.test(bundleSha256)) {
    throw new Error('M07 Candidate or bundle digest is invalid.');
  }

  const profile = getAgentMcpProfileById(profileId);
  if (!profile || profile.id !== M07_MANAGE_INDEX_PROFILE_ID) {
    throw new Error('M07 server accepts only its exact one-shot profile.');
  }
  assertM07ManageIndexUnboundProfile(profile);
  if (!sameArguments(expectedArguments)) {
    throw new Error('M07 server accepts only its fixed no-account create arguments.');
  }

  return {
    profile,
    expectedArguments,
    summaryPath: absoluteSummaryPath,
    candidateSha,
    bundleSha256,
  };
}

export function writeM07SanitizedSummary(summaryPath, summary) {
  const absolute = path.resolve(summaryPath);
  if (!absolute.startsWith(path.resolve(os.tmpdir()) + path.sep)) {
    throw new Error('M07 summary output must remain in the operating-system temp directory.');
  }
  fs.writeFileSync(absolute, JSON.stringify(summary), { mode: 0o600 });
}

export async function evaluateM07ManageIndexGate({
  registry,
  httpRequestCount,
  context = FIXTURE_CONTEXT,
}) {
  if (
    !registry ||
    typeof registry.executeTool !== 'function' ||
    typeof httpRequestCount !== 'function'
  ) {
    throw new TypeError('M07 gate evaluation requires the real ToolRegistry and request counter.');
  }
  try {
    const result = await registry.executeTool(
      M07_MANAGE_INDEX_TOOL,
      M07_MANAGE_INDEX_EXPECTED_ARGUMENTS,
      context,
    );
    return {
      state: 'UNEXPECTED_SUCCESS',
      httpRequestCount: httpRequestCount(),
      writeActionReached: true,
      result,
    };
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : 'UNKNOWN';
    const requests = httpRequestCount();
    if (code === 'AUTH_REQUIRED' && requests === 0) {
      return {
        state: 'AUTH_REQUIRED',
        httpRequestCount: 0,
        writeActionReached: false,
      };
    }
    return {
      state: code,
      httpRequestCount: requests,
      writeActionReached: false,
    };
  }
}

function createSummary({ profile, candidateSha, bundleSha256, catalogBytes, tool, mcpTool }) {
  return {
    schemaVersion: 1,
    profileId: profile.id,
    networkMode: profile.networkMode,
    sourceRevision: candidateSha,
    bundleSha256,
    catalogSha256: sha256(catalogBytes),
    toolName: M07_MANAGE_INDEX_TOOL,
    toolDescriptionSha256: sha256(tool.description),
    inputSchemaSha256: sha256(canonicalJson(mcpTool.inputSchema)),
    expectedArgumentsSha256: sha256(canonicalJson(M07_MANAGE_INDEX_EXPECTED_ARGUMENTS)),
    serverToolNames: [M07_MANAGE_INDEX_TOOL],
    serverToolCount: 1,
    serverResultStatus: 'NOT_RUN',
    allowedCallCount: 0,
    deniedCallCount: 0,
    argumentMatch: false,
    accountBindingCount: 0,
    httpRequestCount: 0,
    authRequiredCount: 0,
    writeActionReached: false,
    privacy: {
      authProfile: 'unbound',
      accountBound: false,
      oauthAttempted: false,
      accountDataRead: false,
      indexDataRead: false,
      indexDataWriteAttempted: false,
      communityRead: false,
      qqPipelineTested: false,
      timClientTested: false,
      rawArgumentsStored: false,
      credentialsStored: false,
    },
  };
}

async function main(argv = process.argv.slice(2)) {
  safeEnvironment();
  const config = parseM07Arguments(argv);
  const currentSha = gitRepositoryText(PRODUCT_ROOT, ['rev-parse', 'HEAD']);
  const currentBundle = computeMcpBundleSha256(PRODUCT_ROOT);
  if (
    currentSha !== config.candidateSha ||
    currentBundle !== config.bundleSha256 ||
    readG26McpBundleAttestation(PRODUCT_ROOT) !== currentBundle ||
    gitRepositoryText(PRODUCT_ROOT, ['status', '--porcelain']) !== ''
  ) {
    throw new Error('M07 server is not running the clean, exact Candidate bundle.');
  }

  const { toMcpTool } = await import('./dist/catalog.js');
  const catalogBytes = fs.readFileSync(path.join(PRODUCT_ROOT, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const catalogTool = catalog.find((item) => item?.name === M07_MANAGE_INDEX_TOOL);
  if (catalogTool?.auth !== 'required' || catalogTool?.risk !== 'write') {
    throw new Error('M07 manage_index catalog policy changed; refusing the one-shot.');
  }

  const storage = new MemoryStorage();
  let httpRequestCount = 0;
  const publicHttpClient = new HttpClient({
    baseUrl: 'https://api.bgm.tv',
    timeoutMs: 1000,
    fetchFn: async () => {
      httpRequestCount += 1;
      throw new Error('M07 offline fixture blocked all HTTP requests.');
    },
  });
  const dependencies = createRuntimeDependenciesWithStorage(storage, {
    clientId: 'run95-m07.invalid',
    clientSecret: 'run95-m07.invalid',
    redirectUri: 'http://127.0.0.1/run95-m07-callback',
    secretKey: TEST_ONLY_SECRET,
    publicHttpClient,
  });
  const registry = new ToolRegistry(dependencies, { profile: 'full', renderTarget: 'chat' });
  const principal = await storage.findOrCreatePrincipal({
    provider: 'local-mcp',
    botInstanceId: FIXTURE_CONTEXT.botInstanceId,
    externalUserId: FIXTURE_CONTEXT.principalId,
  });
  const tool = registry.getTool(M07_MANAGE_INDEX_TOOL);
  if (!tool) throw new Error('M07 ToolRegistry does not contain manage_index.');
  const mcpTool = toMcpTool(tool);
  const summary = createSummary({
    profile: config.profile,
    candidateSha: config.candidateSha,
    bundleSha256: config.bundleSha256,
    catalogBytes,
    tool,
    mcpTool,
  });
  writeM07SanitizedSummary(config.summaryPath, summary);

  const server = new Server(
    { name: 'bangumi-m07-manage-index-auth-gate', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [mcpTool] }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const args = request.params.arguments ?? {};
    if (
      request.params.name !== M07_MANAGE_INDEX_TOOL ||
      !sameArguments(args) ||
      summary.allowedCallCount !== 0
    ) {
      summary.deniedCallCount += 1;
      writeM07SanitizedSummary(config.summaryPath, summary);
      return {
        content: [{ type: 'text', text: 'M07 profile rejected unexpected tool or arguments.' }],
        isError: true,
      };
    }

    summary.allowedCallCount = 1;
    summary.argumentMatch = true;
    writeM07SanitizedSummary(config.summaryPath, summary);
    const outcome = await evaluateM07ManageIndexGate({
      registry,
      context: {
        principalId: principal.id,
        botInstanceId: FIXTURE_CONTEXT.botInstanceId,
        conversationId: FIXTURE_CONTEXT.conversationId,
      },
      httpRequestCount: () => httpRequestCount,
    });
    const accountBindings = await storage.listBindings(principal.id);
    summary.serverResultStatus = outcome.state;
    summary.accountBindingCount = accountBindings.length;
    summary.privacy.accountBound = accountBindings.length > 0;
    summary.httpRequestCount = outcome.httpRequestCount;
    summary.writeActionReached = outcome.writeActionReached;
    if (outcome.state === 'AUTH_REQUIRED') summary.authRequiredCount = 1;
    if (accountBindings.length !== 0) summary.serverResultStatus = 'UNEXPECTED_ACCOUNT_BINDING';
    writeM07SanitizedSummary(config.summaryPath, summary);

    if (outcome.state === 'AUTH_REQUIRED' && accountBindings.length === 0) {
      const safeContent = {
        state: 'AUTH_REQUIRED',
        action: 'create',
        httpRequestCount: 0,
        writeActionReached: false,
      };
      return {
        content: [
          {
            type: 'text',
            text: 'AUTH_REQUIRED: bind a Bangumi account before managing an index. No request was made.',
          },
        ],
        structuredContent: safeContent,
        isError: false,
      };
    }
    return {
      content: [{ type: 'text', text: 'M07 expected AUTH_REQUIRED before any request.' }],
      structuredContent: {
        state: 'UNEXPECTED_RESULT',
        httpRequestCount: outcome.httpRequestCount,
        writeActionReached: outcome.writeActionReached,
      },
      isError: true,
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  const shutdown = async () => {
    try {
      await server.close();
    } catch {
      /* best-effort cleanup */
    }
    try {
      await registry.close();
    } catch {
      /* best-effort cleanup */
    }
    try {
      await storage.close();
    } catch {
      /* best-effort cleanup */
    }
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    process.stderr.write('M07 offline auth-gate MCP server failed closed.\n');
    process.exitCode = 1;
  });
}
