import * as fs from 'node:fs';
import * as path from 'node:path';

export function loadRuntimeEnv(cwd: string = process.cwd()): void {
  for (const file of ['.env.local', '.env']) {
    const envPath = path.join(cwd, file);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
          if (key && process.env[key] === undefined) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}
