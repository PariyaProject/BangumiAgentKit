import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface QueryStrings {
  stringify(value: unknown, options?: Record<string, unknown>): string;
  parse(value: string, options?: Record<string, unknown>): unknown;
}

const localRequire = createRequire(path.join(process.cwd(), 'package.json'));
const sdkRequire = createRequire(localRequire.resolve('@modelcontextprotocol/sdk/server/mcp.js'));
const expressRequire = createRequire(sdkRequire.resolve('express'));
const qs = expressRequire('qs') as QueryStrings;

describe('resolved MCP dependency qs serialization safety', () => {
  const cases = [
    ['JSON object', () => JSON.parse('{"a":[{"toString":"x"}]}')],
    ['null method', () => ({ a: [{ toString: null }] })],
    ['null prototype', () => ({ a: [Object.assign(Object.create(null), { b: 'c' })] })],
    ['nested array', () => ({ a: [[{ toString: 'x' }]] })],
    ['parsed prototype property', () => qs.parse('a[0][toString]=x', { allowPrototypes: true })],
  ] as const;

  for (const [name, input] of cases) {
    for (const encodeValuesOnly of [false, true]) {
      it(`does not throw for ${name}, encodeValuesOnly=${encodeValuesOnly}`, () => {
        expect(() => qs.stringify(input(), { arrayFormat: 'comma', encodeValuesOnly })).not.toThrow();
      });
    }
  }

  it('keeps ordinary flat request values and comma arrays stable', () => {
    expect(qs.stringify({ limit: 1, offset: 0, type: 2 })).toBe('limit=1&offset=0&type=2');
    expect(qs.stringify({ a: ['x', 'y'] }, { arrayFormat: 'comma' })).toBe('a=x%2Cy');
    expect(qs.stringify({ a: ['x', 'y'] }, { arrayFormat: 'comma', encodeValuesOnly: true })).toBe('a=x,y');
  });

  it('preserves supported callable conversion and default object traversal', () => {
    expect(qs.stringify({ a: [{ toString: () => 'ok' }] }, { arrayFormat: 'comma' })).toBe('a=ok');
    expect(() => qs.stringify({ a: [{ toString: null }] })).not.toThrow();
  });
});
