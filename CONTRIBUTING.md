# Contributing

Contributions to BangumiAgentKit are submitted under the Apache License 2.0
unless a separate written agreement or an explicit file notice says otherwise.
By submitting a contribution, you represent that you have the right to do so.

## Development setup

```bash
pnpm install
pnpm setup:local
pnpm db:migrate
pnpm build
pnpm doctor
```

The default local runtime uses SQLite under `~/.bangumi-agent-kit`. PostgreSQL
is available for compatibility checks with `BANGUMI_DB_DRIVER=postgres` and a
`DATABASE_URL`. Do not commit `.env.local`, database files, tokens, or OAuth
secrets.

## Tests and checks

Run the focused checks while developing, then run the release pipeline from
the README:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:contract
pnpm test:semantic
pnpm test:render
pnpm test:integration:sqlite
pnpm test:host
pnpm test:standalone
pnpm self-test -- --json
pnpm smoke:standalone
pnpm openapi:verify
pnpm build
```

Standalone is the local, no-LLM playground. It must call the shared
ToolRegistry, preserve trusted identity and confirmation gates, and never
auto-confirm a write. Use `--profile` for isolated principals in one SQLite
database.

## OpenAPI generation

The checked-in upstream schema is under `openapi/upstream/v0.yaml`. Validate
and regenerate the derived client and operation catalog with:

```bash
pnpm openapi:validate
pnpm openapi:generate
pnpm openapi:verify
```

Do not change upstream license attribution when editing generated files.

## Storage, Renderer, and Host integration

SQLite is the default and PostgreSQL is covered by a separate integration
matrix. Renderer tests may require Chromium; install it with
`pnpm renderer:install`. NoneBot2/Claude host integration is optional to the
Standalone runtime and must remain an external transport boundary.

## Pull requests

Explain the behavioral change, security impact, migration impact, and tests.
Keep changes scoped. Include or update documentation for new user-facing
commands, configuration, or release checks. Never include real credentials or
personal account data in fixtures.
