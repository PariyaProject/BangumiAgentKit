import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const require = createRequire('/opt/bangumi/package.json');
const toolsRequire = createRequire(require.resolve('@bangumi-agent-kit/tools'));
const { Client } = await import(
  pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/index.js'))
);
const { StdioClientTransport } = await import(
  pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/stdio.js'))
);
const { SQLiteStorage, resolveSqlitePath } = await import(
  pathToFileURL(toolsRequire.resolve('@bangumi-agent-kit/db'))
);
const { encryptToken } = await import(
  pathToFileURL(toolsRequire.resolve('@bangumi-agent-kit/auth'))
);
const rendererEntry = toolsRequire.resolve('@bangumi-agent-kit/renderer');
const sharp = createRequire(rendererEntry)('sharp');
const output = '/tmp/qs55-output';
const workspace = fs.mkdtempSync('/tmp/qs55-workspace-');
const dataDir = path.join(workspace, 'data'),
  artifacts = path.join(workspace, 'artifacts');
const key = 'qs55-fake-only-encryption-key-01234567890';
let storage, client;
const facts = {
  schema: 'qs55-compiled-mcp/v1',
  passed: false,
  exactInputs: [],
  results: [],
  mcpClosed: false,
  workspaceRemoved: false,
  fakeStorage: true,
  realAccountActions: 0,
  modelCalls: 0,
  clientMessages: 0,
  failureStage: null,
};
let stage = 'seed';
try {
  storage = await SQLiteStorage.create({ dbPath: resolveSqlitePath(undefined, dataDir) });
  const principal = await storage.findOrCreatePrincipal({
    provider: 'qq',
    botInstanceId: 'qs55-fake-bot',
    externalUserId: 'qs55-fake-external',
  });
  const account = await storage.upsertBangumiAccount({
    id: 'qs55-fake-account',
    bangumiUserId: 991001,
    username: 'qs55-fake-user',
    nickname: 'Synthetic',
  });
  await storage.bindAccount(principal.id, account.id, true);
  const now = new Date();
  await storage.upsertCredential({
    id: 'qs55-fake-credential',
    bangumiAccountId: account.id,
    encryptedAccessToken: encryptToken('qs55-fake-access', key),
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
  const inputs = JSON.parse(fs.readFileSync('/qa/inputs.json', 'utf8'));
  facts.exactInputs = inputs;
  const childEnv = {
    PATH: process.env.PATH,
    HOME: workspace,
    NODE_ENV: 'test',
    QS55_ROLE: 'server',
    QS55_FORCE: process.env.QS55_FORCE || '',
    BANGUMI_DATA_DIR: dataDir,
    BANGUMI_DB_DRIVER: 'sqlite',
    BANGUMI_TOKEN_ENCRYPTION_KEY: key,
    BANGUMI_MCP_IDENTITY_PROVIDER: 'qq',
    BANGUMI_MCP_EXTERNAL_USER_ID: 'qs55-fake-external',
    BANGUMI_MCP_BOT_INSTANCE_ID: 'qs55-fake-bot',
    BANGUMI_MCP_CONVERSATION_ID: 'qs55-fake-conversation',
    BANGUMI_ARTIFACT_DIR: artifacts,
    RENDERER_DISABLE_CHROMIUM_SANDBOX: 'true',
    PLAYWRIGHT_BROWSERS_PATH: '/opt/ms-playwright',
  };
  const args = process.env.QS55_FORCE === 'preloaded' ? ['--require', '/qa/preloaded.cjs'] : [];
  args.push(
    '--import',
    '/qa/trace.mjs',
    '--import',
    '/qa/fixture.mjs',
    '/opt/bangumi/dist/main.js',
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args,
    env: childEnv,
    stderr: 'pipe',
  });
  // Drain only; no native error strings/private payloads are exported.
  transport.stderr?.on('data', () => {});
  client = new Client({ name: 'qs55-fresh-fake-compatibility', version: '1.0.0' });
  stage = 'connect';
  await client.connect(transport);
  for (const [index, input] of inputs.entries()) {
    stage = 'tool-' + index;
    fs.writeFileSync(path.join(output, 'step.json'), JSON.stringify({ index, name: input.name }));
    const result = await client.callTool({ name: input.name, arguments: input.input }, undefined, {
      timeout: 50000,
    });
    if (result.isError || result.content?.length !== 1 || result.content[0]?.type !== 'text')
      throw Error('QS55_TOOL');
    const body = JSON.parse(result.content[0].text);
    if (
      result.structuredContent !== undefined &&
      !isDeepStrictEqual(body, result.structuredContent)
    )
      throw Error('QS55_WIRE');
    const observation = { name: input.name, ok: true, nativePngDecoded: false };
    if (input.name.includes('.render_')) {
      const a = body.artifact;
      if (!a || !/^art_p_[a-f0-9]{24}_[a-f0-9]{32}$/u.test(a.id) || a.mimeType !== 'image/png')
        throw Error('QS55_ARTIFACT');
      const file = path.join(artifacts, 'private', a.id.split('_')[2], a.id + '.png');
      const fd = fs.openSync(
        file,
        fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK,
      );
      let buffer;
      try {
        const stat = fs.fstatSync(fd);
        if (!stat.isFile() || stat.mode & 0o077 || stat.size > 5242880) throw Error('QS55_FILE');
        buffer = fs.readFileSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      const decoded = await sharp(buffer, { limitInputPixels: 28800000 })
        .raw()
        .toBuffer({ resolveWithObject: true });
      if (
        decoded.info.width !== a.width ||
        decoded.info.height !== a.height ||
        decoded.data.length !== a.width * a.height * decoded.info.channels
      )
        throw Error('QS55_PIXELS');
      observation.nativePngDecoded = true;
      fs.rmSync(artifacts, { recursive: true });
    } else if (input.name === 'bangumi.list_collections') {
      if (!Array.isArray(body.items) || body.items.length !== 1 || body.limit !== 1)
        throw Error('QS55_LIST');
    } else if (!['complete', 'partial', 'conflict'].includes(body.state))
      throw Error('QS55_SEMANTIC');
    facts.results.push(observation);
  }
  facts.passed =
    facts.results.length === 11 && facts.results.filter((r) => r.nativePngDecoded).length === 5;
} catch (error) {
  facts.failureStage = stage;
  facts.failureCode = /^QS55_[A-Z_]+$/u.test(error?.message) ? error.message : 'MCP_OR_RUNTIME';
} finally {
  if (storage) await storage.close();
  if (client) {
    try {
      await client.close();
      facts.mcpClosed = true;
    } catch {
      facts.passed = false;
    }
  }
  fs.rmSync(workspace, { recursive: true, force: true });
  facts.workspaceRemoved = !fs.existsSync(workspace);
  facts.passed &&= facts.mcpClosed && facts.workspaceRemoved;
  fs.writeFileSync(path.join(output, 'compiled-mcp.json'), JSON.stringify(facts), { mode: 0o600 });
}
process.exitCode = facts.passed ? 0 : 1;
