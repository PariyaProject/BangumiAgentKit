import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { preserveCatalogUnionNotation } from '../../scripts/lib/catalog-json-schema.js';

describe('stable catalog schema serialization', () => {
  it('preserves the old encoding of a real Zod primitive union', () => {
    const raw = z.toJSONSchema(z.object({ value: z.union([z.string(), z.number()]) }));
    const result = preserveCatalogUnionNotation(raw) as typeof raw;
    expect(result.properties?.value).toEqual({ anyOf: [{ type: 'string' }, { type: 'number' }] });
    expect(result.required).toEqual(['value']);
    expect(result.additionalProperties).toBe(false);
  });

  it('retains surrounding constraints and nontrivial branches without mutating its input', () => {
    const schema = {
      type: ['number', 'null'],
      maximum: 2,
      allOf: [{ anyOf: [{ type: 'string', minLength: 3 }, { const: 1 }] }],
    };
    const original = structuredClone(schema);
    expect(preserveCatalogUnionNotation(schema)).toEqual({
      anyOf: [{ type: 'number' }, { type: 'null' }],
      maximum: 2,
      allOf: [{ anyOf: [{ type: 'string', minLength: 3 }, { const: 1 }] }],
    });
    expect(schema).toEqual(original);
  });

  it('does not rewrite enum, const, default or example objects as schemas', () => {
    const literal = { type: ['string', 'number'] };
    const schema = {
      type: 'object',
      const: literal,
      enum: [literal],
      default: literal,
      examples: [literal],
      properties: { type: { type: ['string', 'number'] } },
    };
    expect(preserveCatalogUnionNotation(schema)).toEqual({
      ...schema,
      properties: { type: { anyOf: [{ type: 'string' }, { type: 'number' }] } },
    });
  });

  it('preserves a pre-existing anyOf rather than overwriting its restriction', () => {
    const schema = { type: ['number', 'null'], anyOf: [{ const: 1 }] };
    expect(preserveCatalogUnionNotation(schema)).toEqual(schema);
  });

  it('traverses nested schema maps, lists, items and boolean schemas', () => {
    const schema = {
      $defs: { entry: { type: ['string', 'number'] } },
      properties: { rows: { type: 'array', items: { type: ['number', 'null'] } } },
      anyOf: [false, { additionalProperties: { type: ['boolean', 'null'] } }],
    };
    expect(preserveCatalogUnionNotation(schema)).toEqual({
      $defs: { entry: { anyOf: [{ type: 'string' }, { type: 'number' }] } },
      properties: {
        rows: { type: 'array', items: { anyOf: [{ type: 'number' }, { type: 'null' }] } },
      },
      anyOf: [false, { additionalProperties: { anyOf: [{ type: 'boolean' }, { type: 'null' }] } }],
    });
  });
});
