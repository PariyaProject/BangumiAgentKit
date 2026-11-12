import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createRelationSafetyMcpServer } from './native-relation-safety-mcp.mjs';
import {
  RELATION_MODEL_PROFILE as P,
  RELATION_MODEL_SERVER_ID as SERVER,
} from '../lib/native-relation-model-profile.mjs';
import { canonicalAgentMcpProfileJson as canonical } from '../lib/agent-mcp-profile-claims.mjs';
import {
  RELATION_MODEL_ROOT as ROOT,
  relationModelSha,
  relationModelResultSha,
  readRelationModelSourceContext,
  validRelationModelClaim,
} from './native-relation-model-report.mjs';
import {
  relationModelHarness,
  assertRelationModelReviewGate,
  readRelationModelStatus,
  assertRelationModelClaimReadback,
} from '../lib/native-relation-model-gates.mjs';

const STARTUP_CODES = new Set([
  'RELATION_MODEL_CONTROL_QUERY_FAILED',
  'RELATION_MODEL_REVIEW_GATE_FAILED',
  'RELATION_MODEL_SOURCE_GATE_FAILED',
  'RELATION_MODEL_LIVE_CI_GATE_FAILED',
  'RELATION_MODEL_CLAIM_GATE_FAILED',
  'RELATION_MODEL_CLAIM_READBACK_FAILED',
  'RELATION_MODEL_NATIVE_CONSTRUCTION_FAILED',
  'RELATION_MODEL_WIRE_RESULT_INVALID',
]);

export function readRelationModelServerGate(gatePath) {
  const parent = path.dirname(path.resolve(gatePath));
  const directory = fs.lstatSync(parent),
    file = fs.lstatSync(gatePath);
  if (
    !fs.realpathSync(parent).startsWith(fs.realpathSync(os.tmpdir()) + path.sep) ||
    !path.basename(parent).startsWith('bgk-relation-model-') ||
    path.basename(gatePath) !== 'gate.json' ||
    !directory.isDirectory() ||
    directory.isSymbolicLink() ||
    directory.uid !== process.getuid() ||
    (directory.mode & 0o777) !== 0o700 ||
    !file.isFile() ||
    file.isSymbolicLink() ||
    file.uid !== process.getuid() ||
    file.nlink !== 1 ||
    (file.mode & 0o777) !== 0o600 ||
    file.size > 65536
  )
    throw new Error('RELATION_MODEL_GATE_FILE_INVALID');
  const descriptor = fs.openSync(gatePath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  let bytes;
  try {
    const opened = fs.fstatSync(descriptor);
    if (
      opened.dev !== file.dev ||
      opened.ino !== file.ino ||
      !opened.isFile() ||
      opened.uid !== process.getuid() ||
      opened.nlink !== 1 ||
      (opened.mode & 0o777) !== 0o600 ||
      opened.size > 65536
    )
      throw new Error('RELATION_MODEL_GATE_FILE_INVALID');
    bytes = fs.readFileSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  const input = JSON.parse(bytes);
  if (Object.keys(input).join(',') !== 'claim' || !validRelationModelClaim(input.claim))
    throw new Error('RELATION_MODEL_GATE_CONTENT_INVALID');
  return { parent, claim: input.claim, gateSha256: relationModelSha(bytes) };
}

/** Normal SDK bridge closes the finite native runtime BEFORE its final successful reply. */
export async function createRelationModelTransportHost({ onChange = () => {} } = {}) {
  const native = createRelationSafetyMcpServer();
  const client = new Client({ name: 'relation-model-native-bridge', version: '1.0.0' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await native.server.connect(st);
  await client.connect(ct);
  const resultSha256 = [];
  let closed = false,
    closing,
    forwarding = false,
    captureFailed = false,
    protocolDenied = 0;
  const closeNative = () =>
    (closing ??= (async () => {
      const results = await Promise.allSettled([client.close(), native.close()]);
      if (results.some((result) => result.status === 'rejected'))
        throw new Error('RELATION_MODEL_CLOSE_FAILED');
      closed = true;
    })());
  const server = new Server({ name: SERVER, version: '1.0.0' }, { capabilities: { tools: {} } });
  const denied = () => {
    protocolDenied++;
    return {
      isError: true,
      content: [{ type: 'text', text: 'NATIVE_RELATION_OBSERVATION_FAILED' }],
      structuredContent: { errorCode: 'NATIVE_RELATION_OBSERVATION_FAILED' },
    };
  };
  server.setRequestHandler(ListToolsRequestSchema, async () =>
    closed ? { tools: [] } : client.listTools(),
  );
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    if (closed || forwarding) {
      captureFailed = true;
      const result = denied();
      await closeNative();
      onChange();
      return result;
    }
    forwarding = true;
    try {
      const result = await client.callTool(request.params, undefined, { signal: extra.signal });
      try {
        if (resultSha256.length >= 2 || result.isError) throw new Error();
        resultSha256.push(relationModelResultSha(result));
      } catch {
        captureFailed = true;
      }
      if (result.isError || ['COMPLETE', 'FAILED'].includes(native.snapshot().phase))
        await closeNative();
      onChange();
      return result;
    } catch {
      captureFailed = true;
      await closeNative();
      onChange();
      return denied();
    } finally {
      forwarding = false;
    }
  });
  return {
    server,
    snapshot: () =>
      structuredClone({
        observation: native.snapshot(),
        resultSha256,
        captureFailed,
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
    throw new Error('RELATION_MODEL_GATE_FILE_INVALID');
  const { parent, claim, gateSha256 } = readRelationModelServerGate(argv[1]);
  // Consume before any live control read; automatic startup cannot reset an attempt.
  fs.writeFileSync(path.join(parent, 'server-started.json'), JSON.stringify({ gateSha256 }), {
    flag: 'wx',
    mode: 0o600,
  });
  let host = null,
    closing,
    lifecycleStage = 'startup',
    failureCode = null;
  const instance = randomUUID();
  const publish = () => {
    const summary = {
      schema: 'native-relation-safety-server-summary/v1',
      sourceMode: 'native-synthetic-relation-safety',
      sourceRevision: claim.sourceCandidateSha,
      bundleSha256: claim.bundleSha256,
      claimSha256: relationModelSha(canonical(claim)),
      serverInstanceId: instance,
      toolNames: P.toolNames,
      lifecycleStage,
      failureCode,
      ...(host?.snapshot() ?? {
        observation: null,
        resultSha256: [],
        captureFailed: false,
        closed: false,
        protocolDenied: 0,
      }),
    };
    const next = path.join(parent, 'summary-next.json');
    const descriptor = fs.openSync(
      next,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW,
      0o600,
    );
    try {
      fs.writeFileSync(descriptor, JSON.stringify(summary));
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    fs.renameSync(next, path.join(parent, 'summary.json'));
  };
  publish();
  try {
    assertRelationModelReviewGate(
      relationModelHarness(['status', '--run', '95', '--pr', String(claim.prNumber)]),
      {
        sourceRevision: claim.sourceCandidateSha,
        bundleSha256: claim.bundleSha256,
        expectedClaim: claim,
      },
    );
    readRelationModelSourceContext(ROOT, claim.sourceCandidateSha);
    assertRelationModelClaimReadback(readRelationModelStatus(claim.prNumber), claim);
    try {
      host = await createRelationModelTransportHost({ onChange: publish });
    } catch {
      throw new Error('RELATION_MODEL_NATIVE_CONSTRUCTION_FAILED');
    }
    lifecycleStage = 'tool';
    publish();
    const close = () =>
      (closing ??= (async () => {
        lifecycleStage = 'cleanup';
        await host.close();
        publish();
      })());
    const transport = new StdioServerTransport();
    process.stdin.once('end', () => {
      void close().catch(() => {
        process.exitCode = 2;
      });
    });
    process.once('SIGTERM', () => {
      void close().finally(() => process.exit(2));
    });
    const deadline = setTimeout(() => {
      void close().finally(() => process.exit(2));
    }, 420000);
    deadline.unref();
    await host.server.connect(transport);
  } catch (error) {
    failureCode = STARTUP_CODES.has(error?.message)
      ? error.message
      : 'RELATION_MODEL_SERVER_START_FAILED';
    publish();
    if (host) await host.close();
    throw new Error(failureCode);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(() => {
    process.stderr.write('RELATION_MODEL_SERVER_START_FAILED\n');
    process.exitCode = 2;
  });
