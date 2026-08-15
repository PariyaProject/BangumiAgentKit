# BangumiAgentKit

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)

BangumiAgentKit is a secure Bangumi runtime foundation for semantic tools,
OAuth accounts, PNG presentation cards, MCP clients, and trusted external
hosts. It can be used directly by a person in Standalone mode or as the
Bangumi tool runtime behind a NoneBot2 + Claude Code host.

## Current status

The v0.1 release candidate foundation is ready for review. SQLite is the
default local storage, PostgreSQL compatibility is covered, OAuth and
multi-account bindings are available, and Renderer/Standalone/NoneBot host
paths have independent smoke tests. No v0.1.0 tag or release has been created.

## Features

- Standalone local console with interactive REPL, non-interactive CLI, JSON
  output, profiles, raw ToolRegistry playground, and `pnpm self-test`.
- Semantic search, subjects, bounded subject comparisons, cast, calendar, episodes,
  bounded episode guides, collection intelligence, auth, and renderer presentation tools.
- OAuth account binding with encrypted credentials, active-account switching,
  and principal isolation.
- SQLite by default, PostgreSQL compatibility, migrations, audit events, and
  atomic write confirmation.
- Optional Chromium PNG renderer with validated ArtifactRef export.
- MCP stdio transport and a trusted NoneBot2/Claude Code external-host example.

## Quick Start: Standalone

This is the shortest path for local testing. PostgreSQL, Docker, NoneBot2,
Claude, and an LLM API key are not required.

```bash
git clone <repository-url>
cd BangumiAgentKit
pnpm install
pnpm setup:local
pnpm build
pnpm standalone
```

Then try:

```text
bak> status
bak> search 少女终末旅行
bak> subject 218707
bak> tool list
```

For scripts, use the same built runtime without the REPL:

```bash
pnpm bak -- search "少女终末旅行"
pnpm bak -- --json status
pnpm bak -- tool describe bangumi.search_subjects
pnpm bak -- tool call bangumi.search_subjects '{"query":"少女终末旅行"}'
pnpm bak -- episode-guide 218707 --max-episodes 24
pnpm bak -- compare 218707 226998
```

Profiles share one SQLite database but resolve to different trusted local
principals:

```bash
pnpm standalone -- --profile personal
pnpm standalone -- --profile test-a
```

PNG rendering is optional:

```bash
pnpm renderer:install
pnpm bak -- render subject 218707 --output "$HOME/Desktop/bangumi.png"
pnpm bak -- render episode-guide 218707 --output "$HOME/Desktop/episode-guide.png"
pnpm bak -- render compare 218707 226998 --output "$HOME/Desktop/subject-comparison.png"
```

`episode-guide` reads one bounded page from the official v0 subject and episode
endpoints, then reports category, ordering, field coverage, duplicates,
truncation, and source limitations. It does not infer watch order, progress, or
unobserved episodes. Use `--category main|sp|op|ed|pv|mad|other` to narrow the
official episode type and `--no-descriptions` to omit bounded descriptions.

## Quick Start: Claude Code MCP

The MCP server is a separate transport over the same ToolRegistry. Build the
workspace, configure trusted identity variables for the local MCP session,
then start it with:

```bash
pnpm build
pnpm start:mcp
```

The server does not accept arbitrary internal principal IDs in normal
production operation. See [security](docs/security.md) and the MCP/host
documentation for the identity boundary.

## Quick Start: Existing Bot

For a working NapCat → NoneBot2 → Claude Code bot, add BangumiAgentKit as the
external MCP/runtime service rather than embedding a second Bangumi client in
the bot:

1. Run `pnpm install`, `pnpm setup:local`, `pnpm build` in this repository.
2. Configure the OAuth and token-encryption variables in `.env.local`.
3. Configure the host identity mapping for the QQ bot/user/conversation.
4. Point the Claude Code MCP command at the built `apps/mcp/dist/main.js`.
5. Run the host contract and smoke checks before enabling writes.

The exact file names, environment variables, and NoneBot adapter steps are in
[the existing-bot integration guide](docs/integrations/nonebot2-existing-bot.zh-CN.md).

## Architecture

```text
Human → StandaloneHost → ToolRegistry → Bangumi Core / OAuth / Renderer → SQLite

NapCat → NoneBot2 → Claude Code → MCP → ToolRegistry → Bangumi Core / OAuth / Renderer
```

Standalone calls the shared ToolRegistry directly and does not start an MCP
child process or require an LLM. MCP is an independently tested external
transport. Both paths use trusted external identity, auth/capability checks,
PendingAction confirmation, audit, and safe error policy.

## Storage and configuration

SQLite is stored at `~/.bangumi-agent-kit/bangumi-agent-kit.sqlite` by default.
Set `BANGUMI_DATA_DIR` or `BANGUMI_SQLITE_PATH` to choose a local location.
PostgreSQL uses `BANGUMI_DB_DRIVER=postgres` and `DATABASE_URL`.

See the complete [configuration reference](docs/configuration.zh-CN.md). It
covers core, SQLite, PostgreSQL, OAuth, Renderer, Standalone, MCP, Host,
Claude, and Artifact settings.

## OAuth and accounts

Standalone owns a local Fastify OAuth callback listener on `127.0.0.1` by
default and starts it without duplicating OAuth route code. `auth login`
prints a URL; the browser may be opened manually. Credentials are encrypted
at rest and never printed. Each `--profile` has an independent principal and
account binding set.

## Renderer and artifacts

Renderer tools return an `ArtifactRef`, not a local path. Standalone export
copies a validated PNG from the authoritative ArtifactStore and refuses to
overwrite an existing destination unless `--force` is supplied. Text, auth,
collection, and raw-tool commands remain usable when Chromium is unavailable;
render commands return `RENDERER_UNAVAILABLE` with installation guidance.

## Documentation

- [Standalone guide](docs/standalone.zh-CN.md)
- [Configuration reference](docs/configuration.zh-CN.md)
- [Existing NoneBot2 bot integration](docs/integrations/nonebot2-existing-bot.zh-CN.md)
- [Manual Standalone QA checklist](docs/testing/standalone-checklist.zh-CN.md)
- [Security model](docs/security.md)
- [Architecture](docs/architecture.md)
- [SQLite](docs/sqlite.md)
- [OAuth](docs/oauth.md)
- [Renderer and artifacts](docs/renderer.md), [artifact security](docs/artifacts.md)
- [Project status](docs/status.md)
- [Contribution and development policy](CONTRIBUTING.md)
- [Third-party provenance](THIRD_PARTY_NOTICES.md)

## Verification

```bash
pnpm version:check
pnpm self-test -- --json
pnpm smoke:standalone
pnpm smoke:v0.1
```

The full final gate is documented in `CONTRIBUTING.md` and the release notes
for the current change. `pnpm run doctor` reports Claude Host as optional and does
not fail a Standalone-only installation because an LLM is absent.

## License

Project-owned code is licensed under the [Apache License 2.0](LICENSE).
Upstream OpenAPI material and third-party dependencies retain their own terms;
see [NOTICE](NOTICE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
