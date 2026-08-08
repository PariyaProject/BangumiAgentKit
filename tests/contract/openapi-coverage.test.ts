import { describe, it, expect } from 'vitest';
import {
  OPERATION_REGISTRY,
  GeneratedBangumiOpenApiClient,
  CalendarClient,
} from '../../packages/bangumi-openapi/src/index.js';

describe('Phase 1: OpenAPI Coverage & Contract Test', () => {
  it('has exactly 56 registered operations in OPERATION_REGISTRY', () => {
    const operationIds = Object.keys(OPERATION_REGISTRY);
    expect(operationIds.length).toBe(56);
  });

  it('includes 55 v0 operations and 1 legacy calendar operation', () => {
    expect(OPERATION_REGISTRY['getCalendar']).toBeDefined();
    expect(OPERATION_REGISTRY['getCalendar']?.method).toBe('GET');
    expect(OPERATION_REGISTRY['getCalendar']?.path).toBe('/calendar');

    expect(OPERATION_REGISTRY['searchSubjects']).toBeDefined();
    expect(OPERATION_REGISTRY['getSubjectById']).toBeDefined();
    expect(OPERATION_REGISTRY['getEpisodes']).toBeDefined();
    expect(OPERATION_REGISTRY['getUserCollection']).toBeDefined();
    expect(OPERATION_REGISTRY['patchUserCollection']).toBeDefined();
    expect(OPERATION_REGISTRY['getMyself']).toBeDefined();
  });

  it('every operation metadata contains required fields', () => {
    for (const [opId, meta] of Object.entries(OPERATION_REGISTRY)) {
      expect(meta.operationId).toBe(opId);
      expect(meta.tag).toBeDefined();
      expect(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).toContain(meta.method);
      expect(meta.path).toMatch(/^\//);
      expect(['none', 'optional', 'required']).toContain(meta.auth);
      expect(Array.isArray(meta.scopes)).toBe(true);
      expect(['read', 'write', 'destructive']).toContain(meta.risk);
      expect(meta.summary).toBeDefined();
    }
  });

  it('GeneratedBangumiOpenApiClient contains methods for all 55 v0 operations', () => {
    const client = new GeneratedBangumiOpenApiClient();
    for (const opId of Object.keys(OPERATION_REGISTRY)) {
      if (opId === 'getCalendar') continue;
      expect(typeof (client as any)[opId]).toBe('function');
    }
  });

  it('CalendarClient contains getCalendar method', () => {
    const client = new CalendarClient();
    expect(typeof client.getCalendar).toBe('function');
  });
});
