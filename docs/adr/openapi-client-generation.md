# ADR: OpenAPI Client & Type Generation Strategy

## Context
Bangumi Agent Kit requires a reliable, type-safe, and fully maintained OpenAPI v0 client.
In earlier iterations, client types were manually defined (`export interface Subject { ... }`, `export interface Character { ... }`), and method signatures contained loose types such as `query?: Record<string, unknown>` and `Promise<any>`.

This approach introduced several issues:
1. Hand-written DTO interfaces duplicated the OpenAPI spec and drifted over time.
2. Required query and body parameters were not enforced at compile time.
3. `$ref` parameters and complex component models were incomplete or hand-crafted.

## Options Considered

### Option 1: `openapi-typescript` + Custom Wrapper Generator (Selected)
- **Mechanism**: Use `openapi-typescript` to generate strict TypeScript interfaces (`schema.ts`) directly from `v0.yaml`. Use a lightweight code generator (`scripts/generate-openapi-client.ts`) to produce a typed wrapper around `HttpClient`.
- **OpenAPI 3.0 & $ref Support**: Complete (handled natively by `openapi-typescript`).
- **Request & Response Typing**: Derives exact query, path, request body, and response types from `operations` and `components["schemas"]`.
- **Parameter Strictness**: Missing required query/body parameters cause TypeScript compile errors.
- **Custom Transport**: 100% integration with existing `HttpClient` (retry, cache, User-Agent, 204 status, 302 image redirects, `BangumiError`).
- **Maintenance Cost**: Very low. Zero runtime dependencies added. Build script is < 200 LOC.

### Option 2: Orval
- **Mechanism**: Use Orval to generate React Query or Axios/Fetch clients.
- **Pros**: Automatic hook generation for frontend frameworks.
- **Cons**: High complexity, opinionated output, requires custom plugin adapters to integrate with `HttpClient` middleware (cache, retry, custom error handling).

### Option 3: OpenAPI Generator CLI (Java-based)
- **Mechanism**: Java `openapi-generator-cli`.
- **Pros**: Multi-language support.
- **Cons**: Requires Java runtime, generates heavy code boilerplate, difficult to customize transport layer.

### Option 4: Pure Custom Compiler
- **Mechanism**: Write an in-house TypeScript compiler to parse YAML schema and output AST/interfaces.
- **Pros**: Full control.
- **Cons**: High maintenance cost, reinvents the wheel for full OpenAPI 3.0 AST parsing, schema dereferencing, and union types.

## Decision
We select **Option 1 (`openapi-typescript` + Custom Wrapper Generator)**.

## Consequences
- `openapi-typescript` produces `packages/bangumi-openapi/src/generated/schema.ts` containing `paths`, `operations`, and `components["schemas"]`.
- `GeneratedBangumiOpenApiClient` and exported DTOs (`Subject`, `Character`, `Person`, etc.) are 100% derived from `schema.ts`.
- All hand-written duplicate DTO interfaces in `generated/index.ts` are removed.
- Compile-time strictness guarantees that omitted required query parameters (e.g. `type` in `getSubjects`) cause TypeScript compilation errors.
