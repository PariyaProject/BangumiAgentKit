/** Eight fixed compiled-MCP calls using fake SQLite identity and a finite provider. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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
const sharp = createRequire(tools.resolve('@bangumi-agent-kit/renderer'))('sharp');
const output = '/tmp/person-account-mcp';
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const workspace = fs.mkdtempSync('/tmp/person-account-workspace-');
const dataDir = path.join(workspace, 'data'),
  artifacts = path.join(workspace, 'artifacts');
const key = 'person-fake-encryption-key-01234567890';
const aggregate = {
  maxSubjects: 1,
  maxSubjectPages: 1,
  maxRelationsPerSubject: 3,
  maxOutputRows: 6,
};
const cases = [
  { name: 'bangumi.get_person_collection', input: { personId: 20 }, expected: 'unknown' },
  { name: 'bangumi.get_person_collection', input: { personId: 21 }, expected: 'empty' },
  { name: 'bangumi.get_person_collection', input: { personId: 22 }, expected: 'raw-label' },
  { name: 'bangumi.list_person_collections', input: { maxItems: 3 }, expected: 'list' },
  { name: 'bangumi.get_collection_entity_consistency', input: aggregate, expected: 'join' },
  { name: 'bangumi.render_collection_entity_consistency', input: aggregate, expected: 'png' },
  { name: 'bangumi.get_person_collection', input: { personId: 23 }, expected: 'parser-error' },
  { name: 'bangumi.get_person_collection', input: { personId: 24 }, expected: 'not-found' },
];
let storage,
  client,
  stage = 'seed';
const facts = {
  schema: 'person-account-compiled-mcp/v1',
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
    botInstanceId: 'person-fake-bot',
    externalUserId: 'person-fake-external',
  });
  const account = await storage.upsertBangumiAccount({
    id: 'person-fake-account',
    bangumiUserId: 990001,
    username: 'person-fake-user',
    nickname: 'Synthetic',
  });
  await storage.bindAccount(principal.id, account.id, true);
  const now = new Date();
  await storage.upsertCredential({
    id: 'person-fake-credential',
    bangumiAccountId: account.id,
    encryptedAccessToken: encryptToken('person-fake-access', key),
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
      '/qa/person-account-fixture.mjs',
      '/opt/bangumi/dist/main.js',
    ],
    env: {
      PATH: process.env.PATH,
      HOME: workspace,
      NODE_ENV: 'test',
      C12_ROLE: 'server',
      C12_FORCE: 'person',
      BANGUMI_DATA_DIR: dataDir,
      BANGUMI_DB_DRIVER: 'sqlite',
      BANGUMI_TOKEN_ENCRYPTION_KEY: key,
      BANGUMI_MCP_IDENTITY_PROVIDER: 'qq',
      BANGUMI_MCP_EXTERNAL_USER_ID: 'person-fake-external',
      BANGUMI_MCP_BOT_INSTANCE_ID: 'person-fake-bot',
      BANGUMI_MCP_CONVERSATION_ID: 'person-fake-conversation',
      BANGUMI_ARTIFACT_DIR: artifacts,
      RENDERER_DISABLE_CHROMIUM_SANDBOX: 'true',
      PLAYWRIGHT_BROWSERS_PATH: '/opt/ms-playwright',
    },
    stderr: 'pipe',
  });
  transport.stderr?.on('data', () => {});
  client = new Client({ name: 'person-wire-synthetic-source-proof', version: '1.0.0' });
  stage = 'connect';
  await client.connect(transport);
  for (const [index, item] of cases.entries()) {
    stage = 'case-' + index;
    fs.writeFileSync(
      path.join(output, 'step.json'),
      JSON.stringify({ index, name: item.name, personId: item.input.personId }),
    );
    const result = await client.callTool({ name: item.name, arguments: item.input }, undefined, {
      timeout: 50000,
    });
    if (result.content?.length !== 1 || result.content[0]?.type !== 'text')
      throw Error('PERSON_TOOL_WIRE');
    const body = JSON.parse(result.content[0].text);
    if (
      result.structuredContent !== undefined &&
      !isDeepStrictEqual(body, result.structuredContent)
    )
      throw Error('PERSON_TOOL_ENVELOPE');
    const observed = { name: item.name, case: item.expected, passed: false };
    if (item.expected === 'parser-error') {
      if (!result.isError || body.error?.code !== 'PARSER_ERROR')
        throw Error('PERSON_EXPECTED_PARSER_ERROR');
    } else {
      if (result.isError) throw Error('PERSON_TOOL_FAILED');
      if (['unknown', 'empty', 'raw-label'].includes(item.expected)) {
        if (
          body.found !== true ||
          body.item?.id !== item.input.personId ||
          body.source?.authScope !== 'account'
        )
          throw Error('PERSON_SINGLE');
        const expected = item.expected === 'empty' ? [] : ['future-role'];
        if (
          item.expected === 'unknown'
            ? Object.hasOwn(body.item, 'career')
            : !isDeepStrictEqual(body.item.career, expected)
        )
          throw Error('PERSON_CAREER');
      } else if (item.expected === 'list') {
        if (
          body.items?.length !== 3 ||
          body.coverage?.observed !== 3 ||
          body.coverage.returned !== 3 ||
          body.source?.authScope !== 'account' ||
          Object.hasOwn(body.items[0], 'career') ||
          !isDeepStrictEqual(body.items[1].career, []) ||
          !isDeepStrictEqual(body.items[2].career, ['future-role'])
        )
          throw Error('PERSON_LIST');
      } else if (item.expected === 'join') {
        if (
          body.state !== 'complete' ||
          body.matches?.length !== 3 ||
          body.conflicts?.length !== 0 ||
          !body.matches.some(
            (match) => match.entity.id === 20 && !Object.hasOwn(match.entity, 'career'),
          )
        )
          throw Error('PERSON_JOIN');
      } else if (item.expected === 'not-found') {
        if (body.found !== false || Object.hasOwn(body, 'item')) throw Error('PERSON_NOT_FOUND');
      } else {
        const a = body.artifact;
        if (!a || !/^art_p_[a-f0-9]{24}_[a-f0-9]{32}$/u.test(a.id) || a.mimeType !== 'image/png')
          throw Error('PERSON_ARTIFACT');
        const file = path.join(artifacts, 'private', a.id.split('_')[2], a.id + '.png');
        const fd = fs.openSync(
          file,
          fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK,
        );
        let buffer;
        try {
          const stat = fs.fstatSync(fd);
          if (!stat.isFile() || stat.mode & 0o077 || stat.size > 5242880)
            throw Error('PERSON_PRIVATE_FILE');
          buffer = fs.readFileSync(fd);
        } finally {
          fs.closeSync(fd);
        }
        const pixels = await sharp(buffer, { limitInputPixels: 28800000 })
          .raw()
          .toBuffer({ resolveWithObject: true });
        if (
          pixels.info.width !== a.width ||
          pixels.info.height !== a.height ||
          pixels.data.length !== a.width * a.height * pixels.info.channels
        )
          throw Error('PERSON_PNG_PIXELS');
        observed.png = {
          width: a.width,
          height: a.height,
          bytes: buffer.length,
          sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
          pixelsDecoded: true,
          privateModeVerified: true,
        };
        fs.writeFileSync(path.join(output, 'preview.png'), buffer, { mode: 0o600 });
        fs.rmSync(artifacts, { recursive: true });
      }
    }
    observed.passed = true;
    facts.results.push(observed);
  }
  facts.passed = facts.results.length === cases.length;
} catch (error) {
  facts.failureStage = stage;
  facts.failureCode = /^PERSON_[A-Z_]+$/u.test(error?.message) ? error.message : 'MCP_OR_RUNTIME';
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
