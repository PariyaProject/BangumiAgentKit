/** Nine fixed compiled-MCP calls using fake SQLite identity and a finite provider. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const runtime = createRequire('/opt/bangumi/package.json');
const tools = createRequire(runtime.resolve('@bangumi-agent-kit/tools'));
const { Client } = await import(
  pathToFileURL(runtime.resolve('@modelcontextprotocol/sdk/client/index.js'))
);
const { StdioClientTransport } = await import(
  pathToFileURL(runtime.resolve('@modelcontextprotocol/sdk/client/stdio.js'))
);
const { SQLiteStorage, resolveSqlitePath } = await import(
  pathToFileURL(tools.resolve('@bangumi-agent-kit/db'))
);
const { encryptToken } = await import(pathToFileURL(tools.resolve('@bangumi-agent-kit/auth')));
const output = '/tmp/entity-page-mcp';
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const workspace = fs.mkdtempSync('/tmp/entity-page-workspace-');
const dataDir = path.join(workspace, 'data'),
  artifacts = path.join(workspace, 'artifacts');
const key = 'page-fake-encryption-key-01234567890';
const personTool = 'bangumi.list_person_collections',
  characterTool = 'bangumi.list_character_collections';
const cases = [
  { name: personTool, input: { maxItems: 1, offset: 0 }, expected: 'bounded-person' },
  { name: 'bangumi.get_person_collection', input: null, expected: 'observed-followup' },
  { name: characterTool, input: { maxItems: 2, offset: 1 }, expected: 'hydration-gap' },
  { name: personTool, input: { maxItems: 1, offset: 9 }, expected: 'empty-collection' },
  { name: personTool, input: { maxItems: 1, offset: 1 }, expected: 'empty-page' },
  {
    name: personTool,
    input: { maxItems: 1, offset: 0 },
    expected: 'wrong-echo',
    error: 'PARSER_ERROR',
  },
  {
    name: characterTool,
    input: { maxItems: 1, offset: 0 },
    expected: 'unavailable',
    error: 'UPSTREAM_UNAVAILABLE',
  },
  {
    name: personTool,
    input: { maxItems: 1, offset: 0 },
    expected: 'too-many-rows',
    error: 'PARSER_ERROR',
  },
  {
    name: personTool,
    input: { maxItems: 1, offset: 0 },
    expected: 'oversized-body',
    error: 'RESPONSE_TOO_LARGE',
  },
];
let selected;
let storage,
  client,
  stage = 'seed';
const facts = {
  schema: 'entity-page-compiled-mcp/v1',
  passed: false,
  results: [],
  mcpClosed: false,
  workspaceRemoved: false,
  fakeStorage: true,
  realAccountActions: 0,
  modelCalls: 0,
  clientMessages: 0,
};
try {
  storage = await SQLiteStorage.create({ dbPath: resolveSqlitePath(undefined, dataDir) });
  const principal = await storage.findOrCreatePrincipal({
    provider: 'qq',
    botInstanceId: 'page-fake-bot',
    externalUserId: 'page-fake-external',
  });
  const account = await storage.upsertBangumiAccount({
    id: 'page-fake-account',
    bangumiUserId: 990001,
    username: 'page-fake-user',
    nickname: 'Synthetic',
  });
  await storage.bindAccount(principal.id, account.id, true);
  const now = new Date();
  await storage.upsertCredential({
    id: 'page-fake-credential',
    bangumiAccountId: account.id,
    encryptedAccessToken: encryptToken('page-fake-access', key),
    expiresAt: new Date(now.getTime() + 3600000),
    requestedCapabilities: [],
    reportedScopes: null,
    scopeEvidence: 'unknown',
    keyVersion: 'v1',
    createdAt: now,
    updatedAt: now,
  });
  await storage.close();
  storage = null;
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      '--import',
      '/qa/calendar-account-closed-guard.mjs',
      '--import',
      '/qa/entity-page-fixture.mjs',
      '/opt/bangumi/dist/main.js',
    ],
    env: {
      PATH: process.env.PATH,
      HOME: workspace,
      NODE_ENV: 'test',
      C12_ROLE: 'server',
      C12_FORCE: 'entity-page',
      BANGUMI_DATA_DIR: dataDir,
      BANGUMI_DB_DRIVER: 'sqlite',
      BANGUMI_TOKEN_ENCRYPTION_KEY: key,
      BANGUMI_MCP_IDENTITY_PROVIDER: 'qq',
      BANGUMI_MCP_EXTERNAL_USER_ID: 'page-fake-external',
      BANGUMI_MCP_BOT_INSTANCE_ID: 'page-fake-bot',
      BANGUMI_MCP_CONVERSATION_ID: 'page-fake-conversation',
      BANGUMI_ARTIFACT_DIR: artifacts,
      RENDERER_DISABLE_CHROMIUM_SANDBOX: 'true',
      PLAYWRIGHT_BROWSERS_PATH: '/opt/ms-playwright',
    },
    stderr: 'pipe',
  });
  transport.stderr?.on('data', () => {});
  client = new Client({ name: 'entity-page-synthetic-source-proof', version: '1.0.0' });
  stage = 'connect';
  await client.connect(transport);
  for (const [index, item] of cases.entries()) {
    stage = 'case-' + index;
    // The follow-up ID is derived only from the previously validated same-target list.
    const input = item.input ?? { personId: selected };
    if (index === 1 && (!Number.isSafeInteger(selected) || selected !== 20))
      throw Error('ECP_SELECTION');
    fs.writeFileSync(
      path.join(output, 'step.json'),
      JSON.stringify({ index, name: item.name, input }),
    );
    const result = await client.callTool({ name: item.name, arguments: input }, undefined, {
      timeout: 30000,
    });
    if (result.content?.length !== 1 || result.content[0]?.type !== 'text')
      throw Error('ECP_TOOL_WIRE');
    const body = JSON.parse(result.content[0].text);
    if (
      result.structuredContent !== undefined &&
      !isDeepStrictEqual(body, result.structuredContent)
    )
      throw Error('ECP_TOOL_ENVELOPE');
    const observed = { name: item.name, case: item.expected, input, passed: false };
    if (item.error) {
      if (!result.isError || body.error?.code !== item.error) throw Error('ECP_EXPECTED_ERROR');
      observed.errorCode = body.error.code;
    } else {
      if (result.isError || body.source?.authScope !== 'account') throw Error('ECP_TOOL_FAILED');
      if (index === 1) {
        if (body.found !== true || body.item?.id !== selected || Object.hasOwn(body.item, 'career'))
          throw Error('ECP_FOLLOWUP');
        observed.selectedFromStep = 0;
        observed.id = body.item.id;
        observed.careerUnknown = true;
      } else {
        const p = body.pagination;
        const expectedTotal = [4, null, 5, 0, 3][index];
        const expectedRows = index === 0 || index === 2 ? 1 : 0;
        const expectedNext = [1, null, 3, undefined, 2][index];
        if (
          body.total !== expectedTotal ||
          body.limit !== input.maxItems ||
          body.offset !== input.offset ||
          body.items?.length !== expectedRows ||
          body.observed !== expectedRows ||
          body.returned !== expectedRows ||
          body.invalidRows !== 0 ||
          body.coverage?.sourceTotal !== expectedTotal ||
          body.coverage.observed !== expectedRows ||
          body.coverage.returned !== expectedRows ||
          body.coverage.maxItems !== input.maxItems ||
          body.coverage.truncated !== (index !== 3) ||
          body.source.paginationContract !== 'server-243e2cd5-entity-page-v1' ||
          p?.validated !== true ||
          p.requestedLimit !== input.maxItems ||
          p.requestedOffset !== input.offset ||
          p.hasMore !== (index !== 3) ||
          p.nextOffset !== expectedNext ||
          p.totalInconsistent !== false ||
          p.stableSnapshot !== false ||
          p.order !== 'created_time_desc' ||
          p.empty !== (index === 3 ? 'collection_empty' : index === 4 ? 'page_empty' : undefined)
        )
          throw Error('ECP_PAGE');
        if (index === 0) {
          if (body.items[0].id !== 20 || Object.hasOwn(body.items[0], 'career'))
            throw Error('ECP_PERSON');
          selected = body.items[0].id;
        } else if (index === 2 && body.items[0].id !== 30) throw Error('ECP_CHARACTER');
        observed.page = {
          total: body.total,
          limit: body.limit,
          offset: body.offset,
          ids: body.items.map((row) => row.id),
          hasMore: p.hasMore,
          nextOffset: p.nextOffset ?? null,
          empty: p.empty ?? null,
          stableSnapshot: p.stableSnapshot,
          invalidRows: body.invalidRows,
        };
      }
    }
    observed.passed = true;
    facts.results.push(observed);
  }
  facts.passed = facts.results.length === cases.length;
} catch (error) {
  facts.failureStage = stage;
  facts.failureCode = /^ECP_[A-Z_]+$/u.test(error?.message) ? error.message : 'MCP_OR_RUNTIME';
} finally {
  // Independent cleanup; a close failure must not prevent the other attempts.
  if (storage) {
    try {
      await storage.close();
    } catch {
      facts.passed = false;
    }
  }
  if (client) {
    try {
      await client.close();
      facts.mcpClosed = true;
    } catch {
      facts.passed = false;
    }
  }
  try {
    fs.rmSync(workspace, { recursive: true, force: true });
  } catch {
    facts.passed = false;
  }
  facts.workspaceRemoved = !fs.existsSync(workspace);
  facts.passed &&= facts.mcpClosed && facts.workspaceRemoved;
  fs.writeFileSync(path.join(output, 'compiled-mcp.json'), JSON.stringify(facts), { mode: 0o600 });
}
process.exitCode = facts.passed ? 0 : 1;
