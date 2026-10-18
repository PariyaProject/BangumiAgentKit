#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
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
} from '../scripts/lib/g26-mcp-bundle.mjs';
import {
  AUTH_START_EXPECTED_ARGUMENTS,
  AUTH_START_EXPECTED_QUERY_KEYS,
  AUTH_START_PROFILE,
  AUTH_START_PROFILE_ID,
  AUTH_START_SERVER_ID,
  AUTH_START_SYNTHETIC_CALLBACK,
  AUTH_START_SYNTHETIC_CLIENT_ID,
  AUTH_START_SYNTHETIC_CLIENT_SECRET,
  AUTH_START_SYNTHETIC_PRINCIPAL,
  AUTH_START_TOOL_NAME,
  sameAuthStartArguments,
} from '../scripts/lib/auth-start-offline-agent-mcp-profile.mjs';

const PRODUCT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_BOT_INSTANCE = 'run95-auth-start-synthetic-bot';
const FIXTURE_CONVERSATION = 'run95-auth-start-synthetic-conversation';
const SYNTHETIC_SECRET_KEY = 'run95-auth-start-local-encryption-key-only-0123456789';
const AUTHORIZATION_URL = 'https://oauth.invalid/authorize';
const EXPECTED_CALLBACK = AUTH_START_SYNTHETIC_CALLBACK;
const EXPECTED_CAPABILITIES = AUTH_START_EXPECTED_ARGUMENTS.capabilities;

function safeEnvironment() {
  for (const key of Object.keys(process.env)) {
    if (/(?:BANGUMI|BGM_|OAUTH|TOKEN|SECRET|CREDENTIAL|API[_-]?KEY|DATABASE_URL)/iu.test(key)) {
      delete process.env[key];
    }
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function parseAuthStartServerArgs(argv) {
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
      ].includes(key) ||
      values.has(key) ||
      index + 1 >= argv.length
    ) {
      throw new Error('Offline auth_start server arguments are invalid.');
    }
    values.set(key, argv[++index]);
  }
  const config = {
    profileId: values.get('--profile-id'),
    argumentsJson: values.get('--arguments-json'),
    summaryPath: values.get('--summary-file'),
    candidateSha: values.get('--candidate-sha'),
    bundleSha256: values.get('--bundle-sha256'),
  };
  if (
    config.profileId !== AUTH_START_PROFILE_ID ||
    config.argumentsJson !== JSON.stringify(AUTH_START_EXPECTED_ARGUMENTS) ||
    typeof config.summaryPath !== 'string' ||
    !path.isAbsolute(config.summaryPath) ||
    !/^[0-9a-f]{40}$/u.test(config.candidateSha ?? '') ||
    !/^[0-9a-f]{64}$/u.test(config.bundleSha256 ?? '')
  ) {
    throw new Error(
      'Offline auth_start profile identity or exact Candidate arguments do not match.',
    );
  }
  return config;
}

function writeSummary(summaryPath, summary) {
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary)}\n`, { mode: 0o600 });
}

function resultSummary(result, stateObservation, counters) {
  let parsed;
  try {
    parsed = new URL(result?.authorizationUrl);
  } catch {
    parsed = null;
  }
  const queryKeys = parsed ? [...parsed.searchParams.keys()].sort() : [];
  const expiresAt = Date.parse(result?.expiresAt ?? '');
  const delta = expiresAt - Date.now();
  return {
    schemaVersion: 1,
    profileId: AUTH_START_PROFILE_ID,
    networkMode: AUTH_START_PROFILE.networkMode,
    resultStatus: parsed ? 'SUCCESS' : 'INVALID_URL',
    authorizationHost: parsed?.hostname ?? null,
    authorizationPath: parsed?.pathname ?? null,
    queryParameterNames: queryKeys,
    expectedQueryParameterNames: [...AUTH_START_EXPECTED_QUERY_KEYS].sort(),
    syntheticClientIdMatched:
      parsed?.searchParams.get('client_id') === AUTH_START_SYNTHETIC_CLIENT_ID,
    callbackMatched: parsed?.searchParams.get('redirect_uri') === EXPECTED_CALLBACK,
    responseTypeIsCode: parsed?.searchParams.get('response_type') === 'code',
    stateOpaqueAndBounded: /^[0-9a-f]{48}$/u.test(parsed?.searchParams.get('state') ?? ''),
    providerScopeAbsent: parsed ? !parsed.searchParams.has('scope') : false,
    expiryWithinTenMinuteWindow: Number.isFinite(expiresAt) && delta >= 585_000 && delta <= 615_000,
    oauthStateCount: stateObservation.createCalls,
    statePrincipalIsSynthetic: stateObservation.principalIsSynthetic,
    stateCapabilityTagMatches: stateObservation.capabilityTagMatches,
    stateExpiryIsTenMinutes: stateObservation.expiryIsTenMinutes,
    httpRequestCount: counters.httpRequestCount,
    accountWriteCount: counters.accountWriteCount,
    credentialWriteCount: counters.credentialWriteCount,
    bindingWriteCount: counters.bindingWriteCount,
    toolCallCount: counters.toolCallCount,
    deniedCallCount: counters.deniedCallCount,
    argumentsMatched: counters.argumentsMatched,
  };
}

async function main(argv = process.argv.slice(2)) {
  safeEnvironment();
  const config = parseAuthStartServerArgs(argv);
  if (
    gitRepositoryText(PRODUCT_ROOT, ['rev-parse', 'HEAD']) !== config.candidateSha ||
    computeMcpBundleSha256(PRODUCT_ROOT) !== config.bundleSha256 ||
    readG26McpBundleAttestation(PRODUCT_ROOT) !== config.bundleSha256 ||
    gitRepositoryText(PRODUCT_ROOT, ['status', '--porcelain', '--untracked-files=all']) !== ''
  ) {
    throw new Error('Offline auth_start server is not running the exact clean Candidate bundle.');
  }

  const { toMcpTool } = await import('./dist/catalog.js');
  const catalogBytes = fs.readFileSync(path.join(PRODUCT_ROOT, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const catalogEntry = catalog.find((item) => item?.name === AUTH_START_TOOL_NAME);
  if (catalogEntry?.auth !== 'none' || catalogEntry?.risk !== 'read') {
    throw new Error('auth_start catalog policy changed; refusing the offline profile.');
  }

  const storage = new MemoryStorage();
  const stateObservation = {
    createCalls: 0,
    principalIsSynthetic: false,
    capabilityTagMatches: false,
    expiryIsTenMinutes: false,
  };
  const counters = {
    httpRequestCount: 0,
    accountWriteCount: 0,
    credentialWriteCount: 0,
    bindingWriteCount: 0,
    toolCallCount: 0,
    deniedCallCount: 0,
    argumentsMatched: false,
  };
  globalThis.fetch = async () => {
    counters.httpRequestCount += 1;
    throw new Error('Offline auth_start fixture blocks global fetch.');
  };
  const originalCreateOAuthSession = storage.createOAuthSession.bind(storage);
  storage.createOAuthSession = async (session) => {
    stateObservation.createCalls += 1;
    stateObservation.principalIsSynthetic = session?.principalId === AUTH_START_SYNTHETIC_PRINCIPAL;
    stateObservation.capabilityTagMatches =
      JSON.stringify(session?.requestedCapabilities) === JSON.stringify(EXPECTED_CAPABILITIES);
    stateObservation.expiryIsTenMinutes =
      Math.abs(session?.expiresAt?.getTime?.() - session?.createdAt?.getTime?.() - 600_000) <=
      1_000;
    return originalCreateOAuthSession(session);
  };
  const wrapForbiddenWrite = (name, field) => {
    const original = storage[name].bind(storage);
    storage[name] = async (...args) => {
      counters[field] += 1;
      return original(...args);
    };
  };
  wrapForbiddenWrite('upsertBangumiAccount', 'accountWriteCount');
  wrapForbiddenWrite('upsertCredential', 'credentialWriteCount');
  wrapForbiddenWrite('replaceActiveBinding', 'bindingWriteCount');
  const publicHttpClient = new HttpClient({
    baseUrl: 'https://api.bgm.tv',
    timeoutMs: 1_000,
    fetchFn: async () => {
      counters.httpRequestCount += 1;
      throw new Error('Offline auth_start fixture blocks every HTTP request.');
    },
  });
  const dependencies = createRuntimeDependenciesWithStorage(storage, {
    clientId: AUTH_START_SYNTHETIC_CLIENT_ID,
    clientSecret: AUTH_START_SYNTHETIC_CLIENT_SECRET,
    redirectUri: EXPECTED_CALLBACK,
    authorizeUrl: AUTHORIZATION_URL,
    secretKey: SYNTHETIC_SECRET_KEY,
    publicHttpClient,
  });
  const registry = new ToolRegistry(dependencies, { profile: 'full', renderTarget: 'chat' });
  const tool = registry.getTool(AUTH_START_TOOL_NAME);
  if (!tool) throw new Error('ToolRegistry does not contain bangumi.auth_start.');
  const mcpTool = toMcpTool(tool);
  const summary = {
    schemaVersion: 1,
    profileId: AUTH_START_PROFILE_ID,
    networkMode: AUTH_START_PROFILE.networkMode,
    sourceRevision: config.candidateSha,
    bundleSha256: config.bundleSha256,
    catalogSha256: sha256(catalogBytes),
    toolName: AUTH_START_TOOL_NAME,
    toolDescriptionSha256: sha256(Buffer.from(tool.description, 'utf8')),
    inputSchemaSha256: sha256(Buffer.from(JSON.stringify(mcpTool.inputSchema), 'utf8')),
    expectedArgumentsSha256: sha256(
      Buffer.from(JSON.stringify(AUTH_START_EXPECTED_ARGUMENTS), 'utf8'),
    ),
    serverToolNames: [AUTH_START_TOOL_NAME],
    serverToolCount: 1,
    resultStatus: 'NOT_CALLED',
    authorizationHost: null,
    authorizationPath: null,
    queryParameterNames: [],
    expectedQueryParameterNames: [...AUTH_START_EXPECTED_QUERY_KEYS].sort(),
    syntheticClientIdMatched: false,
    callbackMatched: false,
    responseTypeIsCode: false,
    stateOpaqueAndBounded: false,
    providerScopeAbsent: false,
    expiryWithinTenMinuteWindow: false,
    oauthStateCount: 0,
    statePrincipalIsSynthetic: false,
    stateCapabilityTagMatches: false,
    stateExpiryIsTenMinutes: false,
    httpRequestCount: 0,
    accountWriteCount: 0,
    credentialWriteCount: 0,
    bindingWriteCount: 0,
    toolCallCount: 0,
    deniedCallCount: 0,
    argumentsMatched: false,
  };
  writeSummary(config.summaryPath, summary);

  const server = new Server(
    { name: AUTH_START_SERVER_ID, version: '1.0.0' },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [mcpTool] }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const args = request.params.arguments ?? {};
    if (
      request.params.name !== AUTH_START_TOOL_NAME ||
      !sameAuthStartArguments(args) ||
      counters.toolCallCount !== 0
    ) {
      counters.deniedCallCount += 1;
      summary.deniedCallCount = counters.deniedCallCount;
      writeSummary(config.summaryPath, summary);
      return {
        content: [
          {
            type: 'text',
            text: 'Offline auth_start profile rejected an unexpected tool or repeated call.',
          },
        ],
        isError: true,
      };
    }

    counters.toolCallCount += 1;
    counters.argumentsMatched = true;
    const result = await registry.executeTool(AUTH_START_TOOL_NAME, args, {
      principalId: AUTH_START_SYNTHETIC_PRINCIPAL,
      botInstanceId: FIXTURE_BOT_INSTANCE,
      conversationId: FIXTURE_CONVERSATION,
    });
    const measured = resultSummary(result, stateObservation, counters);
    Object.assign(summary, measured);
    writeSummary(config.summaryPath, summary);
    const text = `Synthetic offline test authorization URL (do not open or reuse): ${result.authorizationUrl}\nExpires at: ${result.expiresAt}`;
    return {
      content: [{ type: 'text', text }],
      structuredContent: result,
      isError: false,
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    process.stderr.write('Offline auth_start MCP server failed closed.\n');
    process.exitCode = 1;
  });
}
