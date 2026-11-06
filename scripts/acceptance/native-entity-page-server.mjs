import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createNativeEntityPageMcpServer } from './native-entity-page-mcp.mjs';
import { NATIVE_PAGE_PROFILE as P } from '../lib/native-entity-page-profile.mjs';
import { canonicalAgentMcpProfileJson as canonical } from '../lib/agent-mcp-profile-claims.mjs';
import { nativePageHarness, readNativePageStatus, assertNativePageReviewGate, assertNativePageClaimReadback } from '../lib/native-entity-page-gates.mjs';
import { NATIVE_PAGE_ROOT as ROOT, nativePageSha, readNativePageSourceContext, validNativePageClaim } from './native-entity-page-report.mjs';

export function readNativePageServerGate(gatePath) {
  const parent = path.dirname(path.resolve(gatePath));
  const temporaryRoot = fs.realpathSync(os.tmpdir()) + path.sep;
  const directory = fs.lstatSync(parent), file = fs.lstatSync(gatePath);
  if (!fs.realpathSync(parent).startsWith(temporaryRoot) || !path.basename(parent).startsWith('bgk-native-pages-') ||
    path.basename(gatePath) !== 'gate.json' || !directory.isDirectory() || directory.isSymbolicLink() ||
    (directory.mode & 0o777) !== 0o700 || directory.uid !== process.getuid() ||
    !file.isFile() || file.isSymbolicLink() || (file.mode & 0o777) !== 0o600 || file.uid !== process.getuid() ||
    file.size > 65536) throw new Error('NATIVE_PAGE_GATE_FILE_INVALID');
  const bytes = fs.readFileSync(gatePath), input = JSON.parse(bytes.toString('utf8'));
  if (Object.keys(input).join(',') !== 'claim' || !validNativePageClaim(input.claim))
    throw new Error('NATIVE_PAGE_GATE_CONTENT_INVALID');
  return { parent, claim: input.claim, gateSha256: nativePageSha(bytes) };
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.length !== 2 || argv[0] !== '--gate-file') throw new Error('NATIVE_PAGE_SERVER_ARGS_INVALID');
  const { parent, claim, gateSha256 } = readNativePageServerGate(argv[1]);
  const status = nativePageHarness(['status', '--run', '95', '--pr', String(claim.prNumber)]);
  assertNativePageReviewGate(status, { sourceRevision: claim.sourceCandidateSha,
    bundleSha256: claim.bundleSha256, expectedClaim: claim });
  readNativePageSourceContext(ROOT, claim.sourceCandidateSha);
  assertNativePageClaimReadback(readNativePageStatus(claim.prNumber), claim);
  // The global claim allows one model job; this private create-once latch also
  // prevents an automatic MCP process restart from resetting its two-call cap.
  fs.writeFileSync(path.join(parent, 'server-started.json'), JSON.stringify({ gateSha256 }), { flag: 'wx', mode: 0o600 });
  const host = createNativeEntityPageMcpServer({ fetchImpl: globalThis.fetch });
  const instance = randomUUID();
  const publish = () => {
    const snapshot = { schema: 'native-entity-page-server-summary/v1',
      sourceMode: 'native-public-fetch', sourceRevision: claim.sourceCandidateSha,
      bundleSha256: claim.bundleSha256, claimSha256: nativePageSha(canonical(claim)),
      serverInstanceId: instance, toolNames: P.toolNames, observation: host.snapshot() };
    const temporary = path.join(parent, 'summary-new.json');
    fs.writeFileSync(temporary, JSON.stringify(snapshot), { mode: 0o600 });
    fs.renameSync(temporary, path.join(parent, 'summary.json'));
  };
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await host.close();
    publish();
  };
  const transport = new StdioServerTransport();
  const send = transport.send.bind(transport);
  transport.send = async (message) => { publish(); await send(message); };
  process.stdin.once('end', () => { close().catch(() => { process.exitCode = 2; }); });
  process.once('SIGTERM', () => { close().finally(() => process.exit(2)); });
  const deadline = setTimeout(() => { close().finally(() => process.exit(2)); }, 420000);
  deadline.unref();
  publish();
  await host.server.connect(transport);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    const code = /^NATIVE_PAGE_[A-Z_]{1,80}$/u.test(error?.message ?? '') ? error.message : 'NATIVE_PAGE_SERVER_START_FAILED';
    process.stderr.write(code + '\n');
    process.exitCode = 2;
  });
}
