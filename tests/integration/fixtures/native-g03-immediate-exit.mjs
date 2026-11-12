import fs from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  G03_MODEL_PROFILE as P,
  G03_MODEL_SERVER_ID as SERVER,
} from '../../../scripts/lib/native-g03-date-png-profile.mjs';

// A fake model client exits immediately after valid calls/events, exercising
// the real bounded process helper's group cleanup. It never invokes Codex.
const directory = process.argv[2],
  transport = new StdioClientTransport({
    command: process.execPath,
    args: [new URL('native-g03-model-worker.mjs', import.meta.url).pathname, directory],
    stderr: 'pipe',
  });
transport.stderr.on('data', () => {});
const client = new Client({ name: 'synthetic-immediate-model-exit', version: '1.0.0' });
await client.connect(transport);
const results = [];
for (const call of P.calls)
  results.push(await client.callTool({ name: call.toolName, arguments: call.arguments }));
const query = results[0].structuredContent,
  ref = JSON.parse(results[1].content[0].text).artifact;
const artifact = Object.fromEntries(
  ['id', 'mimeType', 'width', 'height'].map((key) => [key, ref[key]]),
);
const answer = JSON.stringify({
  rows: query.items.map(({ id, date }) => ({ id, date: date ?? null })),
  bounds: {
    from: P.calls[0].arguments.from,
    to: P.calls[0].arguments.to,
    fromInclusive: true,
    toExclusive: true,
  },
  estimated: query.coverage.totalKind === 'estimated',
  experimental: query.warnings.some((w) => w.code === 'EXPERIMENTAL_SOURCE'),
  unknownDatesDependOnUpstream: true,
  artifact,
});
const events = [
  { type: 'thread.started' },
  { type: 'turn.started' },
  ...P.calls.map((call, index) => ({
    type: 'item.completed',
    item: {
      type: 'mcp_tool_call',
      id: `synthetic-${index}`,
      server: SERVER,
      tool: call.toolName,
      arguments: call.arguments,
      status: 'completed',
      result: results[index],
    },
  })),
  { type: 'item.completed', item: { type: 'agent_message', text: answer } },
  { type: 'turn.completed' },
];
await new Promise((resolve, reject) =>
  process.stdout.write(events.map((e) => JSON.stringify(e)).join('\n') + '\n', (error) =>
    error ? reject(error) : resolve(),
  ),
);
fs.writeFileSync(path.join(directory, 'fake-client-exited.json'), '{}');
process.exit(0);
