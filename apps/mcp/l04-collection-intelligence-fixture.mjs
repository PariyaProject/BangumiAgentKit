#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { encryptToken } from '@bangumi-agent-kit/auth';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createRuntimeDependenciesWithStorage, ToolRegistry } from '@bangumi-agent-kit/tools';
import {
  L04_SYNTHETIC_COLLECTION_FACTS,
  L04_SYNTHETIC_COLLECTION_INPUT,
} from '../../scripts/acceptance/l04-collection-intelligence-answer-check.mjs';

const TOOL_NAME = 'bangumi.get_collection_intelligence';
const SECRET_KEY = 'l04-synthetic-fixture-key-2026-only';
const ACCESS_TOKEN = 'synthetic-l04-token-never-sent-to-network';
const SYNTHETIC_USERNAME = 'l04-fixture-user';
const SYNTHETIC_PRINCIPAL = 'l04-fixture-principal';

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

function syntheticRows() {
  return Array.from({ length: L04_SYNTHETIC_COLLECTION_FACTS.observedRows }, (_, index) => ({
    subject_id: 990_000 + index,
    type: 3,
    rate: index % 10,
    comment: undefined,
    tags: [
      index < 7
        ? L04_SYNTHETIC_COLLECTION_FACTS.topTag
        : index < 11
          ? '奇幻'
          : index < 15
            ? '科幻'
            : index < 18
              ? '友情'
              : '运动',
    ],
    ep_status: index % 13,
    updated_at: `2026-09-${String((index % 28) + 1).padStart(2, '0')}T00:00:00Z`,
    subject: {
      type: 2,
      name: `Synthetic Fixture Subject ${index + 1}`,
      name_cn: `合成样例条目 ${index + 1}`,
      date: '2025-04-01',
    },
  }));
}

function writeSummary(summaryPath, summary) {
  const absolute = path.resolve(summaryPath);
  const tmpRoot = path.resolve(os.tmpdir()) + path.sep;
  if (!absolute.startsWith(tmpRoot))
    throw new Error('Fixture summary must stay in an OS temporary directory.');
  const temporary = `${absolute}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(summary, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
    flag: 'wx',
  });
  fs.renameSync(temporary, absolute);
}

function removeSensitiveEnvironment() {
  for (const key of Object.keys(process.env)) {
    if (/(?:BANGUMI|BGM_|OAUTH|TOKEN|SECRET|CREDENTIAL|API[_-]?KEY)/iu.test(key))
      delete process.env[key];
  }
}

async function main(argv) {
  if (argv.length !== 2 || argv[0] !== '--summary-file')
    throw new Error('Expected --summary-file <temporary-path>.');
  const summaryPath = argv[1];
  removeSensitiveEnvironment();

  const sourceRequests = [];
  const rows = syntheticRows();
  const fetchFn = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = init.method || 'GET';
    const authorization = new Headers(init.headers).get('authorization');
    const expectedPath = `/v0/users/${SYNTHETIC_USERNAME}/collections`;
    const requestMatches =
      method === 'GET' &&
      url.pathname === expectedPath &&
      url.searchParams.get('limit') === '20' &&
      url.searchParams.get('offset') === '0' &&
      authorization === `Bearer ${ACCESS_TOKEN}`;
    sourceRequests.push({
      method,
      requestMatches,
      bearerPresented: authorization === `Bearer ${ACCESS_TOKEN}`,
    });
    if (!requestMatches) {
      return new Response(JSON.stringify({ detail: 'synthetic fixture rejected the request' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(
      JSON.stringify({
        total: L04_SYNTHETIC_COLLECTION_FACTS.sourceTotal,
        limit: 20,
        offset: 0,
        data: rows,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };

  const storage = new MemoryStorage();
  const principal = await storage.findOrCreatePrincipal({
    provider: 'synthetic-fixture',
    botInstanceId: 'l04-fixture-bot',
    externalUserId: SYNTHETIC_PRINCIPAL,
  });
  const account = await storage.upsertBangumiAccount({
    id: 'l04-synthetic-account',
    bangumiUserId: 990_001,
    username: SYNTHETIC_USERNAME,
    nickname: 'Synthetic Fixture',
  });
  await storage.replaceActiveBinding(principal.id, account.id);
  await storage.upsertCredential({
    id: 'l04-synthetic-credential',
    bangumiAccountId: account.id,
    encryptedAccessToken: encryptToken(ACCESS_TOKEN, SECRET_KEY),
    expiresAt: new Date(Date.now() + 3_600_000),
    requestedCapabilities: ['read:collection'],
    reportedScopes: [],
    scopeEvidence: 'reported',
    keyVersion: 'v1',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const httpClient = new HttpClient({ baseUrl: 'https://api.bgm.tv', fetchFn });
  const dependencies = createRuntimeDependenciesWithStorage(storage, {
    publicHttpClient: httpClient,
    secretKey: SECRET_KEY,
  });
  const registry = new ToolRegistry(dependencies, { profile: 'full' });
  const definition = registry.getTool(TOOL_NAME);
  if (!definition)
    throw new Error('The current Product Candidate does not register collection intelligence.');

  let report = {
    serverToolNames: [TOOL_NAME],
    serverToolCount: 1,
    callAttempts: 0,
    allowedCalls: 0,
    deniedCalls: 0,
    sourceRequestCount: 0,
    sourceRequestMatched: false,
    bearerPresented: false,
    sourceState: null,
    observedRows: null,
    sourceTotal: null,
    truncated: null,
    topTagCount: null,
    writeRequests: 0,
    errorCode: null,
  };
  writeSummary(summaryPath, report);

  const server = new Server(
    { name: 'l04-synthetic-collection-fixture', version: '1.0.0' },
    {
      capabilities: { tools: {} },
    },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: TOOL_NAME,
        description: definition.description,
        inputSchema: {
          type: 'object',
          properties: { maxItems: { type: 'integer', minimum: 20, maximum: 20 } },
          required: ['maxItems'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      },
    ],
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    report = { ...report, callAttempts: report.callAttempts + 1 };
    if (
      request.params.name !== TOOL_NAME ||
      canonicalJson(request.params.arguments || {}) !==
        canonicalJson(L04_SYNTHETIC_COLLECTION_INPUT) ||
      report.callAttempts !== 1
    ) {
      report = { ...report, deniedCalls: report.deniedCalls + 1 };
      writeSummary(summaryPath, report);
      return {
        content: [{ type: 'text', text: 'Synthetic one-tool fixture rejected the request.' }],
        isError: true,
      };
    }

    report = { ...report, allowedCalls: 1 };
    writeSummary(summaryPath, report);
    try {
      const result = await registry.executeTool(TOOL_NAME, L04_SYNTHETIC_COLLECTION_INPUT, {
        principalId: principal.id,
        botInstanceId: 'l04-fixture-bot',
        conversationId: 'l04-fixture-conversation',
        requestId: 'l04-synthetic-request',
      });
      report = {
        ...report,
        sourceRequestCount: sourceRequests.length,
        sourceRequestMatched:
          sourceRequests.length === 1 && sourceRequests[0]?.requestMatches === true,
        bearerPresented: sourceRequests.length === 1 && sourceRequests[0]?.bearerPresented === true,
        sourceState: result.state,
        observedRows: result.coverage.observedRows,
        sourceTotal: result.coverage.sourceTotal,
        truncated: result.coverage.truncated,
        topTagCount: result.data.tags.top[0]?.count ?? null,
        writeRequests: sourceRequests.filter((item) => item.method !== 'GET').length,
      };
      writeSummary(summaryPath, report);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (error) {
      report = {
        ...report,
        sourceRequestCount: sourceRequests.length,
        sourceRequestMatched: sourceRequests.some((item) => item.requestMatches),
        bearerPresented: sourceRequests.some((item) => item.bearerPresented),
        writeRequests: sourceRequests.filter((item) => item.method !== 'GET').length,
        errorCode: typeof error?.code === 'string' ? error.code : 'SYNTHETIC_FIXTURE_ERROR',
      };
      writeSummary(summaryPath, report);
      return {
        content: [{ type: 'text', text: 'Synthetic collection fixture failed closed.' }],
        isError: true,
      };
    }
  });

  await server.connect(new StdioServerTransport());
}

main(process.argv.slice(2)).catch(() => {
  process.stderr.write('L04 synthetic collection MCP fixture failed closed.\n');
  process.exitCode = 1;
});
