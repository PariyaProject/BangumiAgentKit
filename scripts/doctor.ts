import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadRuntimeEnv } from '../packages/config/src/index';
import { resolveSqlitePath } from '../packages/db/src/index';

interface DiagnosticResult {
  category: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  message: string;
  guidance?: string;
}

async function runDoctor() {
  loadRuntimeEnv();
  console.log('=== BangumiAgentKit Doctor ===\n');
  const results: DiagnosticResult[] = [];

  // 1. Node.js Version
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.replace(/^v/, '').split('.')[0] || '0', 10);
  if (major >= 18) {
    results.push({
      category: 'Node Runtime',
      status: 'PASS',
      message: `Node.js ${nodeVersion} (meets minimum requirement v18+)`,
    });
  } else {
    results.push({
      category: 'Node Runtime',
      status: 'FAIL',
      message: `Node.js ${nodeVersion} is below required minimum v18+`,
      guidance: 'Please upgrade Node.js to v18 or later.',
    });
  }

  // 2. Data Directory Writability
  const dataDir = process.env.BANGUMI_DATA_DIR || path.join(os.homedir(), '.bangumi-agent-kit');
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    }
    const testFile = path.join(dataDir, `.write_test_${Date.now()}`);
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    results.push({
      category: 'Data Directory',
      status: 'PASS',
      message: `Data directory (${dataDir}) is writable`,
    });
  } catch (err: any) {
    results.push({
      category: 'Data Directory',
      status: 'FAIL',
      message: `Data directory (${dataDir}) is not writable: ${err.message}`,
      guidance: `Ensure permissions on ${dataDir} allow current user write access.`,
    });
  }

  // 3. Database Backend & Status
  const driver =
    process.env.BANGUMI_DB_DRIVER || (process.env.DATABASE_URL ? 'postgres' : 'sqlite');
  if (driver === 'sqlite') {
    const sqlitePath = resolveSqlitePath();
    if (fs.existsSync(sqlitePath)) {
      results.push({
        category: 'Database (SQLite)',
        status: 'PASS',
        message: `SQLite database exists at ${sqlitePath}`,
      });
    } else {
      results.push({
        category: 'Database (SQLite)',
        status: 'WARN',
        message: `SQLite database file does not exist yet at ${sqlitePath}`,
        guidance: 'Run `pnpm setup:local` or `pnpm db:migrate` to initialize database.',
      });
    }
  } else {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      results.push({
        category: 'Database (PostgreSQL)',
        status: 'PASS',
        message: 'PostgreSQL DATABASE_URL is configured',
      });
    } else {
      results.push({
        category: 'Database (PostgreSQL)',
        status: 'FAIL',
        message: 'BANGUMI_DB_DRIVER is postgres but DATABASE_URL is missing',
        guidance: 'Set DATABASE_URL in environment or switch to SQLite.',
      });
    }
  }

  // 4. Token Encryption Key Config
  const encryptionKey = process.env.BANGUMI_TOKEN_ENCRYPTION_KEY || process.env.BANGUMI_SECRET_KEY;
  if (encryptionKey && encryptionKey.length >= 32) {
    results.push({
      category: 'Token Encryption',
      status: 'PASS',
      message: 'Token encryption key configured (32+ chars)',
    });
  } else {
    results.push({
      category: 'Token Encryption',
      status: 'FAIL',
      message: 'BANGUMI_TOKEN_ENCRYPTION_KEY is missing or too short',
      guidance: 'Run `pnpm setup:local` to generate a secret key in .env.local.',
    });
  }

  // 5. Bangumi OAuth Config
  const clientId = process.env.BANGUMI_OAUTH_CLIENT_ID;
  const clientSecret = process.env.BANGUMI_OAUTH_CLIENT_SECRET;
  if (clientId && clientSecret) {
    results.push({
      category: 'Bangumi OAuth',
      status: 'PASS',
      message: 'BANGUMI_OAUTH_CLIENT_ID and BANGUMI_OAUTH_CLIENT_SECRET are set',
    });
  } else {
    results.push({
      category: 'Bangumi OAuth',
      status: 'WARN',
      message: 'Bangumi OAuth credentials are not fully set',
      guidance: 'Fill BANGUMI_OAUTH_CLIENT_ID and BANGUMI_OAUTH_CLIENT_SECRET in .env.local for full auth capabilities.',
    });
  }

  // 6. MCP Build Output
  const mcpDistPath = path.join(process.cwd(), 'apps', 'mcp', 'dist', 'main.js');
  if (fs.existsSync(mcpDistPath)) {
    results.push({
      category: 'MCP Build',
      status: 'PASS',
      message: `MCP server build output found (${mcpDistPath})`,
    });
  } else {
    results.push({
      category: 'MCP Build',
      status: 'WARN',
      message: `MCP server build output missing at ${mcpDistPath}`,
      guidance: 'Run `pnpm build` to compile workspace packages and applications.',
    });
  }

  // 7. Chromium / Renderer Availability
  try {
    const pwModule = 'playwright';
    const pw = require(pwModule) as { chromium: { executablePath: () => string } };
    const browserPath = pw.chromium.executablePath();
    if (fs.existsSync(browserPath)) {
      results.push({
        category: 'Renderer / Chromium',
        status: 'PASS',
        message: `Chromium browser available (${browserPath})`,
      });
    } else {
      results.push({
        category: 'Renderer / Chromium',
        status: 'WARN',
        message: 'Chromium binary missing; text-only operations will work, render tools will report RENDERER_UNAVAILABLE',
        guidance: 'Run `pnpm renderer:install` if you want image rendering features.',
      });
    }
  } catch {
    results.push({
      category: 'Renderer / Chromium',
      status: 'WARN',
      message: 'Playwright / Chromium not installed in workspace root',
      guidance: 'Run `pnpm renderer:install` if you want image rendering features.',
    });
  }

  // Print Report
  for (const r of results) {
    const icon = r.status === 'PASS' ? '[PASS]' : r.status === 'WARN' ? '[WARN]' : '[FAIL]';
    console.log(`${icon} ${r.category}: ${r.message}`);
    if (r.guidance) {
      console.log(`       └─ Guidance: ${r.guidance}`);
    }
  }

  const hasFail = results.some((r) => r.status === 'FAIL');
  console.log('\n==============================');
  if (hasFail) {
    console.log('Result: FAIL - Resolving FAIL issues is required before deployment.');
    process.exit(1);
  } else {
    console.log('Result: PASS - Environment is ready.');
  }
}

runDoctor().catch((err) => {
  console.error('Doctor failed:', err);
  process.exit(1);
});
