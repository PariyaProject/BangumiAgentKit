import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  RELATION_MODEL_PROFILE as P,
  RELATION_MODEL_SERVER_ID as SERVER,
} from '../../../scripts/lib/native-relation-model-profile.mjs';
import { projectRelationModelAnswer } from '../../../scripts/lib/native-relation-model-answer.mjs';

// Synthetic Codex-shaped stream from REAL SDK results, never an actual model.
const [directory, mode] = process.argv.slice(2);
const emit = (value) => process.stdout.write(JSON.stringify(value) + '\n');
emit({ type: 'thread.started' });
emit({ type: 'turn.started' });
if (mode === 'timeout') {
  setInterval(() => {}, 1000);
} else if (mode === 'output-limit') {
  process.stdout.write('x'.repeat(1024 * 1024));
} else {
  const client = new Client({ name: 'synthetic-codex-shaped-fixture', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      fileURLToPath(new URL('./native-relation-model-server.mjs', import.meta.url)),
      directory,
      mode,
    ],
    env: { PATH: process.env.PATH },
    stderr: 'pipe',
  });
  try {
    await client.connect(transport);
    await client.listTools();
    const results = [];
    for (let i = 0; i < 2; i++) {
      const c = P.calls[i];
      const args = structuredClone(c.arguments);
      if (mode === 'tool-error') args.subjectId = 1;
      const item = {
        type: 'mcp_tool_call',
        id: 'fixture' + i,
        server: SERVER,
        tool: c.toolName,
        arguments: args,
      };
      emit({ type: 'item.started', item: { ...item, status: 'in_progress' } });
      const result = await client.callTool({ name: c.toolName, arguments: args });
      emit({ type: 'item.completed', item: { ...item, status: 'completed', result } });
      if (result.isError) {
        emit({ type: 'turn.failed' });
        process.exitCode = 2;
        break;
      }
      results.push(result);
    }
    if (results.length === 2) {
      emit({
        type: 'item.completed',
        item: { type: 'agent_message', text: JSON.stringify(projectRelationModelAnswer(results)) },
      });
      emit({ type: 'turn.completed' });
      if (mode === 'early-exit') await new Promise((resolve) => process.stdout.end(resolve));
    }
  } finally {
    if (mode === 'early-exit') process.exit(0);
    await client.close();
  }
}
