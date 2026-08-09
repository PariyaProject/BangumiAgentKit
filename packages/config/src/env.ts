import * as fs from 'node:fs';
import * as path from 'node:path';

export function loadRuntimeEnv(cwd: string = process.cwd()): void {
  const candidates = [
    process.env.BANGUMI_ENV_FILE ? path.resolve(process.env.BANGUMI_ENV_FILE) : undefined,
    path.join(cwd, '.env.local'),
    path.join(cwd, '.env'),
  ].filter((value): value is string => Boolean(value));
  const loaded = new Set<string>();

  for (const envPath of candidates) {
    if (loaded.has(envPath)) continue;
    loaded.add(envPath);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed
            .slice(idx + 1)
            .trim()
            .replace(/^["']|["']$/g, '');
          if (key && process.env[key] === undefined) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}
