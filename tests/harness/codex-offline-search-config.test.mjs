import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ACCEPTANCE_DIR = path.join(ROOT, 'scripts/acceptance');
const DEPRECATED_SEARCH_CONFIG = /['"`]features\.web_search(?:_cached|_request)?=false['"`]/u;

test('Codex acceptance runners use top-level web_search and avoid deprecated feature toggles', () => {
  const runners = readdirSync(ACCEPTANCE_DIR)
    .filter((name) => /^run-.*\.mjs$/u.test(name))
    .map((name) => ({ name, source: readFileSync(path.join(ACCEPTANCE_DIR, name), 'utf8') }));
  const codexRunners = runners.filter(
    ({ source }) => source.includes("'--model'") || /const MODEL\s*=/u.test(source),
  );
  const deprecated = codexRunners
    .filter(({ source }) => DEPRECATED_SEARCH_CONFIG.test(source))
    .map(({ name }) => name)
    .sort();
  const missingDisabledSetting = codexRunners
    .filter(({ source }) => !source.includes('web_search="disabled"'))
    .map(({ name }) => name)
    .sort();

  assert.deepEqual(
    { deprecated, missingDisabledSetting },
    {
      deprecated: [],
      missingDisabledSetting: [],
    },
  );
});
