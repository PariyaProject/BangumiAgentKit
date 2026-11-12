import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createG03NativeMcpServer } from './g03-native-discovery-mcp.mjs';
import { createG03ModelWireObservation } from '../lib/native-g03-date-png-wire.mjs';
import {
  G03_MODEL_PROFILE as P,
  G03_MODEL_SERVER_ID as SERVER,
} from '../lib/native-g03-date-png-profile.mjs';
import { canonicalAgentMcpProfileJson as canonical } from '../lib/agent-mcp-profile-claims.mjs';
import {
  g03ModelHarness,
  readG03ModelStatus,
  assertG03ModelReviewGate,
  assertG03ModelClaimReadback,
} from '../lib/native-g03-date-png-gates.mjs';
import {
  G03_MODEL_ROOT as ROOT,
  g03ModelSha,
  readG03ModelSourceContext,
  validG03ModelClaim,
} from './native-g03-date-png-report.mjs';

export function readG03ModelServerGate(gatePath) {
  const parent = path.dirname(path.resolve(gatePath));
  const temporaryRoot = fs.realpathSync(os.tmpdir()) + path.sep;
  const directory = fs.lstatSync(parent),
    file = fs.lstatSync(gatePath);
  if (
    !fs.realpathSync(parent).startsWith(temporaryRoot) ||
    !path.basename(parent).startsWith('bgk-g03-date-png-model-') ||
    path.basename(gatePath) !== 'gate.json' ||
    !directory.isDirectory() ||
    directory.isSymbolicLink() ||
    (directory.mode & 0o777) !== 0o700 ||
    directory.uid !== process.getuid() ||
    !file.isFile() ||
    file.isSymbolicLink() ||
    file.nlink !== 1 ||
    (file.mode & 0o777) !== 0o600 ||
    file.uid !== process.getuid() ||
    file.size > 65536
  )
    throw new Error('G03_MODEL_GATE_FILE_INVALID');
  const bytes = fs.readFileSync(gatePath),
    input = JSON.parse(bytes.toString('utf8'));
  if (Object.keys(input).join(',') !== 'claim' || !validG03ModelClaim(input.claim))
    throw new Error('G03_MODEL_GATE_CONTENT_INVALID');
  return { parent, claim: input.claim, gateSha256: g03ModelSha(bytes) };
}

/** Keep MCP transport alive after its finite native runtime has been disposed.
 * Closing before the final successful reply prevents process-group cleanup on
 * immediate model exit from racing Chromium/artifact disposal. */
export async function createG03ModelTransportHost({ onChange = () => {} } = {}) {
  const native = await createG03NativeMcpServer(),
    wire = createG03ModelWireObservation(native);
  const client = new Client({ name: 'g03-native-model-bridge', version: '1.0.0' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  let catalog;
  try {
    await native.server.connect(st);
    await client.connect(ct);
    catalog = await client.listTools();
  } catch {
    await Promise.allSettled([client.close(), native.close()]);
    throw new Error('G03_MODEL_NATIVE_CONSTRUCTION_FAILED');
  }
  let closed = false,
    closing,
    protocolDenied = 0,
    forwarding = false;
  const closeNative = () =>
    (closing ??= (async () => {
      await client.close();
      await native.close();
      closed = true;
      onChange();
    })());
  const server = new Server({ name: SERVER, version: '1.0.0' }, { capabilities: { tools: {} } });
  const denied = () => ({
    content: [{ type: 'text', text: 'G03_NATIVE_OBSERVATION_FAILED' }],
    structuredContent: { errorCode: 'G03_NATIVE_OBSERVATION_FAILED' },
    isError: true,
  });
  server.setRequestHandler(ListToolsRequestSchema, async () => structuredClone(catalog));
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    if (closed || forwarding || protocolDenied > 0) {
      protocolDenied++;
      await closeNative();
      onChange();
      return denied();
    }
    forwarding = true;
    try {
      const result = await client.callTool(request.params, undefined, { signal: extra.signal });
      wire.capture({ result });
      if (result.isError || ['COMPLETE', 'FAILED'].includes(native.snapshot().phase))
        await closeNative();
      onChange();
      return result;
    } catch {
      await closeNative();
      onChange();
      return denied();
    } finally {
      forwarding = false;
    }
  });
  return {
    server,
    snapshot: () => ({
      observation: native.snapshot(),
      ...wire.snapshot(),
      closed,
      protocolDenied,
    }),
    async close() {
      await closeNative();
      await server.close();
    },
  };
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.length !== 2 || argv[0] !== '--gate-file')
    throw new Error('G03_MODEL_SERVER_ARGS_INVALID');
  const { parent, claim, gateSha256 } = readG03ModelServerGate(argv[1]);
  // Consume process startup before any control read or construction: a failed
  // first startup cannot cause an automatic replacement server to reset state.
  fs.writeFileSync(path.join(parent, 'server-started.json'), JSON.stringify({ gateSha256 }), {
    flag: 'wx',
    mode: 0o600,
  });
  const status = g03ModelHarness(['status', '--run', '95', '--pr', String(claim.prNumber)]);
  assertG03ModelReviewGate(status, {
    sourceRevision: claim.sourceCandidateSha,
    bundleSha256: claim.bundleSha256,
    expectedClaim: claim,
  });
  readG03ModelSourceContext(ROOT, claim.sourceCandidateSha);
  assertG03ModelClaimReadback(readG03ModelStatus(claim.prNumber), claim);
  // The delivered factory owns a random temp directory. Keep it, and any
  // Chromium temp profiles, under this process group's verified private root.
  // The parent can clean that root even if the owned group reaches its deadline.
  process.env.TMPDIR = parent;
  let host;
  const instance = randomUUID();
  let closing;
  const publish = () => {
    const summary = {
      schema: 'native-g03-date-png-server-summary/v1',
      sourceMode: 'native-synthetic-discovery-date-png',
      sourceRevision: claim.sourceCandidateSha,
      bundleSha256: claim.bundleSha256,
      claimSha256: g03ModelSha(canonical(claim)),
      serverInstanceId: instance,
      toolNames: P.toolNames,
      ...host.snapshot(),
    };
    const temporary = path.join(parent, 'summary-new.json');
    fs.writeFileSync(temporary, JSON.stringify(summary), { mode: 0o600 });
    fs.renameSync(temporary, path.join(parent, 'summary.json'));
  };
  const close = () =>
    (closing ??= (async () => {
      await host.close();
      publish();
    })());
  host = await createG03ModelTransportHost({ onChange: publish });
  const transport = new StdioServerTransport();
  process.stdin.once('end', () => {
    close().catch(() => {
      process.exitCode = 2;
    });
  });
  process.once('SIGTERM', () => {
    close().finally(() => process.exit(2));
  });
  const deadline = setTimeout(() => {
    close().finally(() => process.exit(2));
  }, 420000);
  deadline.unref();
  publish();
  await host.server.connect(transport);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    const code = /^G03_MODEL_[A-Z_]{1,80}$/u.test(error?.message ?? '')
      ? error.message
      : 'G03_MODEL_SERVER_START_FAILED';
    process.stderr.write(code + '\n');
    process.exitCode = 2;
  });
}
