import { describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

describe('setup-local import safety', () => {
  it('does not perform setup or mutate the environment when imported', async () => {
    const originalCwd = process.cwd();
    const originalEnv = { ...process.env };
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgm-setup-import-safety-'));
    const cwd = path.join(tmpDir, 'cwd');
    const homeDir = path.join(tmpDir, 'home');
    const dataDir = path.join(tmpDir, 'data');
    fs.mkdirSync(cwd);
    fs.mkdirSync(homeDir);

    process.chdir(cwd);
    process.env = { ...originalEnv, HOME: homeDir, BANGUMI_DATA_DIR: dataDir };
    const envBeforeImport = { ...process.env };

    try {
      vi.resetModules();
      await import('../../scripts/lib/setup-local.js');

      expect({ ...process.env }).toEqual(envBeforeImport);
      expect(fs.existsSync(path.join(cwd, '.env.local'))).toBe(false);
      expect(fs.existsSync(path.join(dataDir, 'bangumi-agent-kit.sqlite'))).toBe(false);
      expect(fs.existsSync(path.join(homeDir, '.bangumi-agent-kit'))).toBe(false);
    } finally {
      process.chdir(originalCwd);
      process.env = originalEnv;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
