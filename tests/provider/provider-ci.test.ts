import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('PR-7B provider CI contract', () => {
  it('SC17: executes the provider suite in its dedicated required GitHub job', () => {
    const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/ci.yml'), 'utf8');
    const providerJob =
      workflow.match(/\n\x20{2}provider-foundation:\n([\s\S]*?)(?=\n\x20{2}[a-z0-9-]+:\n|$)/)?.[1] ?? '';

    expect(providerJob).toContain('pnpm install --frozen-lockfile');
    expect(providerJob).toContain('pnpm typecheck');
    expect(providerJob).toContain('pnpm test:provider');
  });
});
