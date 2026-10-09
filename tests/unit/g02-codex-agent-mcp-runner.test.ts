import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
} from 'node:fs';
import os from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  G02_TOOL_PROFILES,
  canonicalG02ClaimPath,
  buildCodexExecArgs,
  createG02OneShotClaim,
  validateRunnerArgs,
} from '../../scripts/acceptance/run-g02-codex-agent-mcp.mjs';
import path from 'node:path';

const base = {
  root: '/tmp/bgk-g02-candidate',
  nodePath: '/usr/bin/node',
  summaryPath: '/tmp/bgk-g02-summary.json',
  sourceRevision: 'a'.repeat(40),
  bundleSha256: 'b'.repeat(64),
};

function configs(args: string[]) {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--config') values.push(args[index + 1] ?? '');
  }
  return values;
}

describe('G02 current catalog one-tool runner', () => {
  it('pins query_subjects to the exact argument profile and isolated Luna Max session', () => {
    const args = buildCodexExecArgs({ ...base, toolName: 'bangumi.query_subjects' });
    const values = configs(args);
    expect(args.slice(0, 7)).toEqual([
      'exec',
      '--ignore-user-config',
      '--strict-config',
      '--ephemeral',
      '--json',
      '--model',
      'gpt-6-luna',
    ]);
    expect(values).toContain('model_reasoning_effort="max"');
    expect(args).toContain('read-only');
    expect(G02_TOOL_PROFILES['bangumi.query_subjects'].argumentProfile).toBe(
      'g02-2024-isekai-query-v1',
    );
    expect(values).toContain('features.shell_tool=false');
    expect(values).toContain('features.web_search=false');
    expect(values).toContain('features.browser_use=false');
    expect(values).toContain('features.computer_use=false');
    expect(values).toContain('features.multi_agent=false');
    expect(values).toContain('history.persistence="none"');
    expect(values).toContain(
      'mcp_servers.bgk_g02_one_tool.enabled_tools=["bangumi.query_subjects"]',
    );
    expect(
      args.some(
        (value) =>
          value.includes('2024-01-01') && value.includes('2025-01-01') && value.includes('异世界'),
      ),
    ).toBe(true);
  });

  it('exposes only render_query_subjects in its independent Codex invocation', () => {
    const args = buildCodexExecArgs({ ...base, toolName: 'bangumi.render_query_subjects' });
    const values = configs(args);
    expect(G02_TOOL_PROFILES['bangumi.render_query_subjects'].argumentProfile).toBe(
      'g02-2024-isekai-render-v1',
    );
    expect(values).toContain(
      'mcp_servers.bgk_g02_one_tool.enabled_tools=["bangumi.render_query_subjects"]',
    );
    expect(values).not.toContain(
      'mcp_servers.bgk_g02_one_tool.enabled_tools=["bangumi.query_subjects"]',
    );
  });

  it('requires both the Run 95 marker and the exact runner entrypoint', () => {
    expect(validateRunnerArgs(['--help'])).toBe('help');
    expect(validateRunnerArgs(['--run', '95'])).toBe('run');
    expect(() => validateRunnerArgs(['--run', '96'])).toThrow(/Pass --run 95/u);
  });

  it('creates one durable mode-0600 claim and refuses the second claim', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'g02-one-shot-claim-'));
    try {
      execFileSync('git', ['init', '-q'], { cwd: root });
      const claimPath = canonicalG02ClaimPath(root);
      const authorization = {
        sourceRevision: 'a'.repeat(40),
        bundleSha256: 'b'.repeat(64),
        baseSha: 'c'.repeat(40),
        prNumber: 117,
      };
      const claim = createG02OneShotClaim(claimPath, authorization, root);
      expect(claim.state).toBe('CLAIMED');
      expect(JSON.parse(readFileSync(claimPath, 'utf8'))).toEqual(claim);
      expect(statSync(claimPath).mode & 0o777).toBe(0o600);
      expect(() => createG02OneShotClaim(claimPath, authorization, root)).toThrow(
        /already exists/u,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects a Git metadata symlink that points outside the common Git directory', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'g02-claim-symlink-'));
    try {
      execFileSync('git', ['init', '-q'], { cwd: root });
      const redirectedDirectory = path.join(root, 'redirected');
      mkdirSync(redirectedDirectory);
      symlinkSync(redirectedDirectory, path.join(root, '.git', 'pariya-agent-state'), 'dir');
      const claimPath = canonicalG02ClaimPath(root);
      expect(() =>
        createG02OneShotClaim(
          claimPath,
          {
            sourceRevision: 'a'.repeat(40),
            bundleSha256: 'b'.repeat(64),
            baseSha: 'c'.repeat(40),
            prNumber: 117,
          },
          root,
        ),
      ).toThrow(/scratch clone Git metadata/u);
      expect(existsSync(path.join(redirectedDirectory, 'g02-run95-one-shot-claim.json'))).toBe(
        false,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
