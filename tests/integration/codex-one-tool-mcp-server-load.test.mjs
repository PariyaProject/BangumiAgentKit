import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { createCodexOneToolMcpToolList } from '../../apps/mcp/codex-one-tool-mcp-server.mjs';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import { RENDER_SUBJECT_CARD_OFFLINE_PROFILE_ID } from '../../scripts/lib/render-subject-card-offline-profile.mjs';

const productRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('one-tool MCP server module imports without starting its stdio entry point', async () => {
  const serverModule = await import('../../apps/mcp/codex-one-tool-mcp-server.mjs');
  assert.equal(typeof serverModule, 'object');
});

test('custom one-tool startup exposes the fixed render_subject_card profile before any claim', () => {
  const profile = getAgentMcpProfileById(RENDER_SUBJECT_CARD_OFFLINE_PROFILE_ID);
  const tool = {
    name: profile.toolName,
    description: 'Render one public Subject card.',
    input: z.object({
      subjectId: z.number(),
      includeCollection: z.boolean().optional(),
    }),
    auth: 'optional',
    risk: 'read',
    scopes: [],
  };

  const exposed = createCodexOneToolMcpToolList([tool], {
    toolName: profile.toolName,
    toolNames: [profile.toolName],
    profile,
  });

  assert.equal(exposed.length, 1);
  assert.equal(exposed[0].name, profile.toolName);
  assert.deepEqual(exposed[0].annotations, {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  });
  assert.equal(exposed[0].inputSchema.properties.includeCollection.type, 'boolean');
  assert.equal(tool.auth, 'optional', 'catalog definition must not be mutated by the profile adapter');
  assert.equal(exposed[0].auth, undefined, 'the MCP tool shape must not expose catalog auth metadata');

  const unsafeProfile = {
    ...profile,
    calls: [{
      ...profile.calls[0],
      arguments: { ...profile.calls[0].arguments, includeCollection: true },
    }],
  };
  assert.throws(() => createCodexOneToolMcpToolList([tool], {
    toolName: profile.toolName,
    toolNames: [profile.toolName],
    profile: unsafeProfile,
  }), /auth=none, risk=read/u);

  assert.throws(() => createCodexOneToolMcpToolList([tool], {
    toolName: profile.toolName,
    toolNames: [profile.toolName],
  }), /auth=none, risk=read/u);
  assert.throws(() => createCodexOneToolMcpToolList([
    tool,
    { ...tool },
  ], {
    toolName: profile.toolName,
    toolNames: [profile.toolName],
    profile,
  }), /exactly one/u);
});

test('offline auth_start MCP module imports without stdio and resolves the repository root', async () => {
  const serverModule = await import('../../apps/mcp/codex-auth-start-offline-mcp-server.mjs');
  assert.equal(serverModule.PRODUCT_ROOT, productRoot);
});
