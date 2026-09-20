# Compact MCP Profile

`bangumi-compact-v1` is the reusable model-facing profile for small Bot and
assistant deployments. It is selected explicitly; the default `ToolRegistry`
surface remains `full` for existing SDK, standalone, and developer workflows.

The profile exposes exactly four public, read-only tools:

- `bangumi.search_subjects` — bounded name/ID search;
- `bangumi.get_subject` — details for a known subject ID;
- `bangumi.get_subject_cast` — bounded character and actor/voice-actor data;
- `bangumi.query_subjects` — bounded discovery by year, month, season, date,
  tags, concepts, and other supported filters.

The profile is an allowlist over the existing tool definitions. It does not
duplicate HTTP clients, change result semantics, or silently rewrite schemas.
Write tools, OAuth/account management, raw operation dispatch, collection
access, render/file tools, and other read tools are not registered in this
mode. This means both `tools/list` and a direct `tools/call` observe the same
boundary.

## Selecting it

TypeScript callers can select the profile while constructing a registry or MCP
server:

```ts
const registry = new ToolRegistry(dependencies, { profile: 'compact' });
const server = new BangumiMcpServer({ dependencies, profile: 'compact' });
```

The stdio entrypoint accepts `BANGUMI_MCP_PROFILE=compact`. Omitting the
variable keeps the full profile for backwards compatibility. `mode: 'curated'`
is retained as a compatibility alias for `profile: 'compact'`; new code should
use the profile name.

Applications should use `COMPACT_MCP_PROFILE` and
`COMPACT_MCP_TOOL_NAMES` for catalog and drift checks instead of copying the
allowlist. Deployment-specific limits such as response byte budgets may still
be applied by the application boundary, after the upstream schema has been
validated.

The profile deliberately does not claim that a bounded discovery result is a
complete database enumeration. Callers must preserve the upstream coverage,
truncation, evidence, and limitation fields when formatting the result.
