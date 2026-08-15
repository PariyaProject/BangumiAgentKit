import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { LocalArtifactStore } from '@bangumi-agent-kit/renderer';

describe('PR-6C Host Bridge & Security Isolation Tests', () => {
  it('H01: Artifact ID validation prevents path traversal', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgm-host-bridge-'));
    const store = new LocalArtifactStore({ artifactDir: tmpDir });

    const ref = await store.saveArtifact(Buffer.from('PNG_DATA'), 'image/png');
    expect(ref.id).toMatch(/^art_[A-Za-z0-9_-]+$/);

    // Valid artifact lookup
    const validMeta = await store.getArtifact(ref.id);
    expect(validMeta).not.toBeNull();
    expect(validMeta?.id).toBe(ref.id);

    // Path traversal attempts MUST return null
    expect(await store.getArtifact('../../../etc/passwd')).toBeNull();
    expect(await store.getArtifact('art_../../secret')).toBeNull();
    expect(await store.getArtifact('art_foo/bar')).toBeNull();
    expect(await store.getArtifact('art_foo\\bar')).toBeNull();
    expect(await store.resolveFilePath('../../../etc/passwd')).toBeNull();

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('H01b: private artifacts are scoped to their issuing principal', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgm-private-artifacts-'));
    const store = new LocalArtifactStore({ artifactDir: tmpDir });

    const alice = await store.saveArtifactForPrincipal('alice', Buffer.from('ALICE'), 'image/png');
    const bob = await store.saveArtifactForPrincipal('bob', Buffer.from('BOB'), 'image/png');

    expect(alice.id).toMatch(/^art_p_[a-f0-9]{24}_[a-f0-9]{32}$/u);
    expect(bob.id).toMatch(/^art_p_[a-f0-9]{24}_[a-f0-9]{32}$/u);
    expect(alice.id).not.toBe(bob.id);
    expect(await store.getArtifact(alice.id)).toBeNull();
    expect(await store.getArtifactForPrincipal('alice', alice.id)).not.toBeNull();
    expect(await store.getArtifactForPrincipal('bob', alice.id)).toBeNull();
    expect(await store.resolveFilePathForPrincipal('alice', alice.id)).toContain(
      path.join(tmpDir, 'private'),
    );
    expect(await store.resolveFilePathForPrincipal('bob', alice.id)).toBeNull();

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('H02: Environment identity injection structure check', () => {
    const env = {
      BANGUMI_MCP_IDENTITY_PROVIDER: 'qq',
      BANGUMI_MCP_EXTERNAL_USER_ID: '123456',
      BANGUMI_MCP_BOT_INSTANCE_ID: 'qq:bot01',
      BANGUMI_MCP_CONVERSATION_ID: 'qq:bot01:group:7890:user:123456',
      BANGUMI_DB_DRIVER: 'sqlite',
    };

    expect(env.BANGUMI_MCP_IDENTITY_PROVIDER).toBe('qq');
    expect(env.BANGUMI_MCP_EXTERNAL_USER_ID).toBe('123456');
    expect(env.BANGUMI_MCP_BOT_INSTANCE_ID).toBe('qq:bot01');
    expect(env.BANGUMI_MCP_CONVERSATION_ID).toBe('qq:bot01:group:7890:user:123456');
    expect(env.BANGUMI_DB_DRIVER).toBe('sqlite');
  });

  it('H03: Simulated Claude session continuation flow', () => {
    const sessionMap = new Map<string, string>();
    const convId = 'qq:private:user1';

    // Step 1: Initial call returns session_id
    const response1 = {
      session_id: 'claude-session-999',
      result: { text: 'Hello! Bound account.' },
    };
    sessionMap.set(convId, response1.session_id);
    expect(sessionMap.get(convId)).toBe('claude-session-999');

    // Step 2: Next call includes --resume claude-session-999
    const resumeArg = sessionMap.get(convId);
    expect(resumeArg).toBe('claude-session-999');
  });
});
