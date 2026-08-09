import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import {
  BANGUMI_OAUTH_CALLBACK_PATH,
  DEFAULT_BANGUMI_OAUTH_REDIRECT_URI,
  loadRuntimeEnv,
} from '@bangumi-agent-kit/config';
import { SQLiteStorage, resolveSqlitePath } from '@bangumi-agent-kit/db';

export interface SetupLocalOptions {
  cwd?: string;
  dataDir?: string;
}

export async function setupLocal(options: SetupLocalOptions = {}) {
  const cwd = options.cwd || process.cwd();
  loadRuntimeEnv(cwd);
  console.log('=== BangumiAgentKit Local Setup ===\n');

  const dataDir =
    options.dataDir ||
    process.env.BANGUMI_DATA_DIR ||
    path.join(os.homedir(), '.bangumi-agent-kit');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    console.log(`✓ Created data directory: ${dataDir}`);
  } else {
    console.log(`✓ Data directory exists: ${dataDir}`);
  }

  const envLocalPath = path.join(cwd, '.env.local');
  let envContent = '';

  if (fs.existsSync(envLocalPath)) {
    console.log(`✓ Existing .env.local file found.`);
    envContent = fs.readFileSync(envLocalPath, 'utf-8');
  } else {
    const generatedKey = crypto.randomBytes(32).toString('hex');

    envContent = `# BangumiAgentKit Local Configuration
BANGUMI_DB_DRIVER=sqlite
BANGUMI_DATA_DIR=${dataDir}
BANGUMI_TOKEN_ENCRYPTION_KEY=${generatedKey}

# Bangumi OAuth Credentials (Required for authentication)
# Register app at https://bgm.tv/dev/app
BANGUMI_OAUTH_CLIENT_ID=
BANGUMI_OAUTH_CLIENT_SECRET=
BANGUMI_OAUTH_REDIRECT_URI=${DEFAULT_BANGUMI_OAUTH_REDIRECT_URI}
`;
    fs.writeFileSync(envLocalPath, envContent, { mode: 0o600 });
    console.log(`✓ Created .env.local with newly generated BANGUMI_TOKEN_ENCRYPTION_KEY.`);
  }

  // Ensure .env.local is in .gitignore
  const gitignorePath = path.join(cwd, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    if (!gitignoreContent.includes('.env.local')) {
      fs.appendFileSync(gitignorePath, '\n.env.local\n');
      console.log(`✓ Added .env.local to .gitignore.`);
    }
  }

  // Initialize SQLite database
  const sqlitePath = resolveSqlitePath(undefined, dataDir);
  console.log(`\nInitializing SQLite database at ${sqlitePath}...`);
  const storage = await SQLiteStorage.create({ dbPath: sqlitePath });
  await storage.close();
  console.log(`✓ SQLite database initialized successfully.`);

  console.log('\n=== Next Steps ===');
  if (
    !envContent.includes('BANGUMI_OAUTH_CLIENT_ID=') ||
    envContent.includes('BANGUMI_OAUTH_CLIENT_ID=\n') ||
    envContent.includes('BANGUMI_OAUTH_CLIENT_ID=""')
  ) {
    console.log('! Please fill in your Bangumi OAuth credentials in .env.local:');
    console.log('  - BANGUMI_OAUTH_CLIENT_ID');
    console.log('  - BANGUMI_OAUTH_CLIENT_SECRET');
  }
  console.log('Run `pnpm doctor` to verify your environment readiness.');

  return { envLocalPath, dataDir, callbackPath: BANGUMI_OAUTH_CALLBACK_PATH };
}

setupLocal().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
