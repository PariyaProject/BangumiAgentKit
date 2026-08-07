import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';

const UPSTREAM_URL = 'https://raw.githubusercontent.com/bangumi/api/master/open-api/v0.yaml';
const TARGET_PATH = path.join(__dirname, '..', 'openapi', 'upstream', 'v0.yaml');

async function syncOpenApi() {
  console.log(`[sync-openapi] Target path: ${TARGET_PATH}`);
  let content: string;

  if (fs.existsSync(TARGET_PATH)) {
    console.log('[sync-openapi] Found local v0.yaml spec');
    content = fs.readFileSync(TARGET_PATH, 'utf-8');
  } else {
    console.log(`[sync-openapi] Fetching v0.yaml from ${UPSTREAM_URL}...`);
    const res = await fetch(UPSTREAM_URL);
    if (!res.ok) {
      throw new Error(`Failed to fetch OpenAPI spec: ${res.status} ${res.statusText}`);
    }
    content = await res.text();
    fs.mkdirSync(path.dirname(TARGET_PATH), { recursive: true });
    fs.writeFileSync(TARGET_PATH, content, 'utf-8');
    console.log('[sync-openapi] Downloaded and saved v0.yaml');
  }

  // Parse YAML to validate
  const parsed = YAML.parse(content);
  if (!parsed || !parsed.openapi || !parsed.paths) {
    throw new Error('Invalid OpenAPI document structure');
  }

  const pathCount = Object.keys(parsed.paths).length;
  let operationCount = 0;
  for (const p of Object.values(parsed.paths) as Record<string, any>[]) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      if (p[method]?.operationId) {
        operationCount++;
      }
    }
  }

  console.log(`[sync-openapi] Successfully validated OpenAPI spec.`);
  console.log(`[sync-openapi] Total Paths: ${pathCount}, Total Operations: ${operationCount}`);
}

syncOpenApi().catch((err) => {
  console.error('[sync-openapi] Error:', err);
  process.exit(1);
});
