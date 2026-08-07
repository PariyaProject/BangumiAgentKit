import { describe, it, expect } from 'vitest';
import { MODULE_NAME as coreName } from '../../packages/bangumi-core/src/index.js';
import { MODULE_NAME as openapiName } from '../../packages/bangumi-openapi/src/index.js';

describe('Workspace Phase 0 Verification', () => {
  it('correctly exports module names from workspace packages', () => {
    expect(coreName).toBe('bangumi-core');
    expect(openapiName).toBe('bangumi-openapi');
  });
});
