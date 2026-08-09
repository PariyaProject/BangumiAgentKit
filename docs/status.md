# Project status

## Available in the v0.1 release-candidate foundation

- OpenAPI-derived Bangumi client and coverage/registry generation
- Semantic read and write tools with Zod validation
- OAuth state handling, encrypted TokenBroker credentials, and account binding
- Multi-account listing, active-account switching, and principal isolation
- SQLite default storage with migrations, WAL/busy handling, and PostgreSQL compatibility
- MCP stdio transport with trusted external identity and Host confirmation grant
- Secure PNG Renderer, ArtifactStore, expiry and export validation
- Standalone local console, profiles, JSON mode, raw ToolRegistry playground,
  embedded local OAuth callback, self-test, and release smoke
- NoneBot2/Claude Code external Host bridge with fake-Claude test coverage

## Deferred scope

- Built-in LLM Orchestrator
- Native QQ adapter
- Native TypeScript OneBot adapter
- Redis-backed distributed coordination
- Distributed artifact storage
- HTML Provider
- A statically linked single-file binary using pkg/nexe
- npm package publication and a `v0.1.0` tag/release

Standalone v0.1 is a Node workspace application, not a native executable. It
uses the platform Node runtime, native SQLite dependency, and optional
Playwright/Chromium runtime by design.
