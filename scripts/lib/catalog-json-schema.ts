/** Keep the acceptance catalog stable across equivalent Zod union encodings.
 * Traverse schema-valued keywords only: const/enum/default/examples are data.
 */
export function preserveCatalogUnionNotation(schema: unknown): unknown {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return schema;
  const result: Record<string, unknown> = { ...schema };
  for (const key of [
    'properties',
    'patternProperties',
    '$defs',
    'definitions',
    'dependentSchemas',
  ]) {
    const map = result[key];
    if (map && typeof map === 'object' && !Array.isArray(map)) {
      result[key] = Object.fromEntries(
        Object.entries(map).map(([name, child]) => [name, preserveCatalogUnionNotation(child)]),
      );
    }
  }
  for (const key of [
    'additionalProperties',
    'unevaluatedProperties',
    'propertyNames',
    'additionalItems',
    'contains',
    'items',
    'if',
    'then',
    'else',
    'not',
  ]) {
    const child = result[key];
    if (child !== undefined)
      result[key] = Array.isArray(child)
        ? child.map(preserveCatalogUnionNotation)
        : preserveCatalogUnionNotation(child);
  }
  for (const key of ['allOf', 'anyOf', 'oneOf', 'prefixItems']) {
    const children = result[key];
    if (Array.isArray(children)) result[key] = children.map(preserveCatalogUnionNotation);
  }
  const types = result.type;
  const allowed = new Set(['null', 'boolean', 'object', 'array', 'number', 'integer', 'string']);
  if (
    Array.isArray(types) &&
    types.length > 1 &&
    types.every((type) => typeof type === 'string' && allowed.has(type)) &&
    !('anyOf' in result)
  ) {
    result.anyOf = types.map((type) => ({ type }));
    delete result.type;
  }
  return result;
}
