import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadRuntimeEnv } from '@bangumi-agent-kit/config';
import { buildSubjectCardViewModel } from '@bangumi-agent-kit/renderer';
import { LocalArtifactStore, RenderService } from '@bangumi-agent-kit/renderer';
import { StandaloneHost } from './standalone-host.js';

export type SelfTestStatus = 'PASS' | 'SKIP' | 'FAIL';

export interface SelfTestCheck {
  id: string;
  status: SelfTestStatus;
  message: string;
}

export interface SelfTestReport {
  name: 'BangumiAgentKit Self-Test';
  version: '0.1.0';
  checks: SelfTestCheck[];
  pass: number;
  skip: number;
  fail: number;
  remoteWrites: 0;
}

export interface SelfTestOptions {
  profile?: string;
  dataDir?: string;
  dbPath?: string;
  online?: boolean;
  auth?: boolean;
  render?: boolean;
  artifactDir?: string;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function check(id: string, status: SelfTestStatus, message: string): SelfTestCheck {
  return { id, status, message };
}

function isPng(buffer: Buffer): boolean {
  return buffer.subarray(0, 8).equals(PNG_SIGNATURE);
}

async function isRendererAvailable(): Promise<boolean> {
  try {
    const playwright = await import('playwright');
    return fs.existsSync(playwright.chromium.executablePath());
  } catch {
    return false;
  }
}

function reportFromChecks(checks: SelfTestCheck[]): SelfTestReport {
  return {
    name: 'BangumiAgentKit Self-Test',
    version: '0.1.0',
    checks,
    pass: checks.filter((item) => item.status === 'PASS').length,
    skip: checks.filter((item) => item.status === 'SKIP').length,
    fail: checks.filter((item) => item.status === 'FAIL').length,
    remoteWrites: 0,
  };
}

export async function runSelfTest(options: SelfTestOptions = {}): Promise<SelfTestReport> {
  loadRuntimeEnv();
  const checks: SelfTestCheck[] = [];
  const dataDir =
    options.dataDir ||
    process.env.BANGUMI_DATA_DIR ||
    path.join(os.homedir(), '.bangumi-agent-kit');
  const artifactDir = options.artifactDir || path.join(dataDir, '.self-test-artifacts');
  const previousArtifactDir = process.env.BANGUMI_ARTIFACT_DIR;
  process.env.BANGUMI_ARTIFACT_DIR = artifactDir;
  let host: StandaloneHost | undefined;

  try {
    try {
      fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
      checks.push(check('config', 'PASS', 'Runtime configuration loaded'));
      checks.push(check('data-dir', 'PASS', 'Data directory is writable'));
    } catch (err) {
      checks.push(check('config', 'FAIL', `Runtime configuration failed: ${String(err)}`));
      return reportFromChecks(checks);
    }

    try {
      host = await StandaloneHost.create({
        profile: options.profile || 'self-test',
        dataDir,
        dbPath: options.dbPath,
        oauthPort: 0,
        artifactStore: new LocalArtifactStore({ artifactDir }),
        startOAuthServer: true,
      });
      checks.push(check('sqlite', 'PASS', 'SQLite opened successfully'));
      checks.push(check('migrations', 'PASS', 'SQLite migrations are ready'));
      checks.push(check('principal', 'PASS', 'Standalone principal resolved'));
      checks.push(
        check('tool-registry', 'PASS', `${host.getRegistry().getTools().length} tools registered`),
      );
      checks.push(check('artifact-store', 'PASS', 'ArtifactStore initialized'));
      const health = await host.getOAuthStatus();
      if (health.ready) {
        const response = await host.checkOAuthHealth();
        checks.push(
          check(
            'oauth-routes',
            response.statusCode === 200 ? 'PASS' : 'FAIL',
            response.statusCode === 200
              ? 'Local OAuth routes respond'
              : 'Local OAuth route health check failed',
          ),
        );
      } else {
        checks.push(check('oauth-routes', 'FAIL', 'Local OAuth listener did not start'));
      }
    } catch (err) {
      checks.push(
        check('runtime', 'FAIL', `Standalone runtime initialization failed: ${String(err)}`),
      );
      return reportFromChecks(checks);
    }

    if (options.online) {
      try {
        const result = await host.executeTool('bangumi.search_subjects', {
          query: '少女終末旅行',
          limit: 1,
        });
        const valid = Boolean(
          result && typeof result === 'object' && 'status' in result && 'candidates' in result,
        );
        checks.push(
          check(
            'public-api',
            valid ? 'PASS' : 'FAIL',
            valid ? 'Bangumi public read schema parsed' : 'Bangumi public read shape was invalid',
          ),
        );
      } catch (err) {
        checks.push(check('public-api', 'FAIL', `Bangumi public read failed: ${String(err)}`));
      }
    } else {
      checks.push(check('public-api', 'SKIP', 'Use --online for the optional public API read'));
    }

    if (options.auth) {
      const status = await host.getStatus();
      if (!status.oauth.bound) {
        checks.push(
          check('authenticated-read', 'SKIP', 'No active account is bound to this profile'),
        );
      } else {
        try {
          const result = await host.executeTool('bangumi.get_my_profile', {});
          checks.push(
            check(
              'authenticated-read',
              result ? 'PASS' : 'FAIL',
              result ? 'Authenticated read succeeded' : 'Authenticated read returned no result',
            ),
          );
        } catch (err) {
          checks.push(
            check('authenticated-read', 'FAIL', `Authenticated read failed: ${String(err)}`),
          );
        }
      }
    } else {
      checks.push(
        check('authenticated-read', 'SKIP', 'Use --auth for the optional authenticated read'),
      );
    }

    if (options.render) {
      if (!(await isRendererAvailable())) {
        checks.push(check('renderer', 'SKIP', 'Chromium is unavailable; renderer is optional'));
      } else {
        const renderService = new RenderService();
        try {
          const viewModel = buildSubjectCardViewModel({
            id: 1,
            name: 'BangumiAgentKit Fixture',
            nameCn: 'BangumiAgentKit 测试卡片',
            type: 'anime',
            summary: 'Deterministic local self-test fixture.',
            nsfw: false,
            locked: false,
          });
          const result = await renderService.renderCard(viewModel);
          const store = new LocalArtifactStore({ artifactDir });
          const ref = await store.saveArtifact(result.buffer, 'image/png', {
            width: result.width,
            height: result.height,
          });
          const metadata = await store.getArtifact(ref.id);
          const filePath = await store.resolveFilePath(ref.id);
          const bytes = filePath ? fs.readFileSync(filePath) : Buffer.alloc(0);
          checks.push(
            check(
              'renderer',
              metadata && filePath && isPng(bytes) && result.width > 0 && result.height > 0
                ? 'PASS'
                : 'FAIL',
              metadata && filePath && isPng(bytes)
                ? 'Renderer fixture produced a valid PNG ArtifactRef'
                : 'Renderer fixture validation failed',
            ),
          );
          if (filePath) fs.rmSync(filePath, { force: true });
          fs.rmSync(path.join(artifactDir, `${ref.id}.json`), { force: true });
        } catch (err) {
          checks.push(check('renderer', 'FAIL', `Renderer fixture failed: ${String(err)}`));
        } finally {
          await renderService.close().catch(() => undefined);
        }
      }
    } else {
      checks.push(
        check('renderer', 'SKIP', 'Use --render for the optional local Chromium fixture'),
      );
    }
  } finally {
    await host?.close().catch(() => undefined);
    if (previousArtifactDir === undefined) delete process.env.BANGUMI_ARTIFACT_DIR;
    else process.env.BANGUMI_ARTIFACT_DIR = previousArtifactDir;
  }

  return reportFromChecks(checks);
}

export function formatSelfTestReport(report: SelfTestReport): string {
  const lines = [report.name, ''];
  for (const item of report.checks) lines.push(`[${item.status}] ${item.id}: ${item.message}`);
  lines.push(
    '',
    `${report.pass} PASS`,
    `${report.skip} SKIP`,
    `${report.fail} FAIL`,
    'Remote writes: 0',
  );
  return lines.join('\n');
}
