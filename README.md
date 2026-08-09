# BangumiAgentKit (v0.1 pre-release development)

> Lightweight, secure, multi-account agentic kit & Model Context Protocol (MCP) server for Bangumi (bgm.tv).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https.mit.org/licenses/MIT)

BangumiAgentKit provides a v0.1 release candidate MCP server and tools ecosystem for interacting with Bangumi (bgm.tv). It enables AI agents to search subjects, manage collections, query characters and calendar schedules, render high-quality presentation cards, and safely execute write operations with explicit confirmation gates.

---

## Architecture

```
[ Platform Host (e.g. NapCatQQ / OneBot11) ]
                  │
                  ▼
[ External Orchestrator (NoneBot2 + Claude Code `claude -p`) ]
                  │  (Injects trusted identity env & MCP stdio)
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    BangumiAgentKit MCP                      │
├──────────────────────────────┬──────────────────────────────┤
│  Tools & Semantic Policy     │  Render Card Service         │
│  - bangumi.search_subjects   │  - bangumi.render_subject    │
│  - bangumi.manage_collection │  - bangumi.render_calendar   │
│  - bangumi.auth_*            │  - LocalArtifactStore        │
├──────────────────────────────┴──────────────────────────────┤
│  TokenBroker & Multi-Account Storage                        │
│  - SQLite Engine (~/.bangumi-agent-kit/bangumi-agent-kit)   │
│  - Keyring AES-256-GCM Token Encryption                     │
│  - PostgreSQL Support (via DATABASE_URL)                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Features

- 📦 **Zero-Dependency Local Storage**: SQLite (`better-sqlite3`) as default zero-setup database stored in `~/.bangumi-agent-kit/bangumi-agent-kit.sqlite`.
- 🔐 **Multi-Account & Trusted Identity**: Bind multiple Bangumi accounts to a platform principal (e.g. QQ user), switch active account seamlessly, and isolate tokens safely.
- 🎨 **Render Card Artifacts**: Render rich PNG cards for subjects, cast lists, collection progress, search results, and calendars.
- 🤖 **External Host Integration**: First-class support for NoneBot2 + Claude Code (`claude -p`) host orchestrators.
- 🛡️ **Write Confirmation & Audit**: Two-turn confirmation policy for destructive write operations with full audit log tracking.

---

## Quick Start

### 1. Setup Environment

```bash
# Install dependencies, configure the local database, and build packages
pnpm install
pnpm setup:local
pnpm build

# Run environment doctor
pnpm doctor
```

### 2. Install Renderer (Optional for PNG Cards)

```bash
pnpm renderer:install
```

### 3. Run API and MCP Servers

```bash
# Start the API server
pnpm start:api

# In another terminal, start MCP via stdio
pnpm start:mcp
```

---

## Storage & Configuration

| Environment Variable           | Default Value                                 | Description                                                |
| ------------------------------ | --------------------------------------------- | ---------------------------------------------------------- |
| `BANGUMI_DATA_DIR`             | `~/.bangumi-agent-kit`                        | Base directory for storage & artifacts                     |
| `BANGUMI_DB_DRIVER`            | `sqlite`                                      | Database driver (`sqlite` or `postgres`)                   |
| `BANGUMI_SQLITE_PATH`          | `<BANGUMI_DATA_DIR>/bangumi-agent-kit.sqlite` | Custom SQLite file path                                    |
| `DATABASE_URL`                 | None                                          | PostgreSQL connection URI (auto-enables `postgres` driver) |
| `BANGUMI_OAUTH_CLIENT_ID`      | None                                          | Bangumi OAuth App Client ID                                |
| `BANGUMI_OAUTH_CLIENT_SECRET`  | None                                          | Bangumi OAuth App Client Secret                            |
| `BANGUMI_TOKEN_ENCRYPTION_KEY` | Hex Key                                       | AES-256-GCM encryption secret key                          |

---

## Documentation

- [SQLite Storage Architecture](docs/sqlite.md)
- [Multi-Account & Identity Management](docs/multi-account.md)
- [External Host Integration (NoneBot2 + Claude Code)](docs/host-integration.md)
- [Artifact Store & Renderer Security](docs/artifacts.md)

---

## License

This project is licensed under the [MIT License](LICENSE).
