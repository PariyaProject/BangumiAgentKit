# External Host Integration

PR-6R-B's first-class integration is an existing NoneBot2 + NapCat/OneBot11
application delegating selected messages to Claude Code. BangumiAgentKit owns
the MCP tools and server-side state; it does not own an LLM orchestrator or
the whole bot application.

## Runtime contract

```text
NoneBot -> claude -p -> node apps/mcp/dist/main.js
```

The host passes a trusted external identity to the MCP child:

```text
BANGUMI_MCP_IDENTITY_PROVIDER=qq
BANGUMI_MCP_EXTERNAL_USER_ID=<QQ user id>
BANGUMI_MCP_BOT_INSTANCE_ID=qq:<bot self id>
BANGUMI_MCP_CONVERSATION_ID=qq:<bot>:private:<user>
```

For a group message, the conversation is:

```text
qq:<bot>:group:<group>:user:<user>
```

The user suffix is intentional. Users in the same group must not share a
Claude session, pending confirmation, or Bangumi principal. MCP resolves the
external tuple through `Storage.findOrCreatePrincipal()`; neither Claude nor
NoneBot chooses the internal `prc_*` value.

## Configuration

Run:

```bash
pnpm setup:local
pnpm build
pnpm doctor:host
```

Use a stable `CLAUDE_WORKDIR`, a private `BANGUMI_DATA_DIR`, and an absolute
`BANGUMI_ENV_FILE` when Claude's workdir is outside the repository. Runtime env
precedence is:

```text
existing process.env > explicit BANGUMI_ENV_FILE > cwd/.env.local > cwd/.env
```

The generated MCP config uses stable server name `bangumi`, an absolute built
MCP entry, SQLite, and the configured data directory. `--strict-mcp-config`
and `--allowedTools mcp__bangumi__*` prevent unrelated MCP servers from being
silently introduced. The bridge does not enable broad Claude permission bypass
flags.

## Persistent state and security boundaries

Host-only state lives at `<BANGUMI_DATA_DIR>/host-bridge.sqlite` and is not a
schema change to the Bangumi DB. It stores session IDs, pending confirmation
summary/ID, TTLs, and safe error codes. It never stores transcripts, OAuth
secrets, or access tokens. A WAL SQLite lease and per-conversation asyncio lock
prevent simultaneous `--resume` calls for one conversation.

Artifacts are capability-like IDs such as `art_abc`. The model receives the ID,
not a path. The Python host derives `<artifact-root>/<id>.png`, checks the
metadata ID/mime/expiry, file size, and PNG signature, and ignores any metadata
`filePath`. Invalid artifacts are omitted while text remains deliverable.

Destructive and bulk writes stay behind the existing MCP PendingAction gate.
The host never adds `_confirmationId` automatically. Claude may use a persisted
pending ID only after an explicit user confirmation, and MCP still checks
principal, bot, conversation, payload hash, expiry, and atomic single-use claim.
If a Claude session disappears while a pending action exists, the host fails
closed and asks the user to initiate the operation again.

## Existing NoneBot projects

Choose one of these integration levels:

1. Instantiate `ClaudeHostService.from_env()` once and call
   `bangumi_host.adapter.handle_bangumi_agent_message(...)` from an existing
   matcher. Send `result.response.text` and validated `result.artifact_paths`.
2. Load `examples/nonebot2-claude-code/plugin.py`; it provides only an explicit
   `/bangumi` matcher and does not block unrelated bot features.
3. Copy `bangumi_host/`, `response-schema.json`, and `system-prompt.md` into
   the existing bot package. Keep NoneBot imports in the application adapter.

The generic host modules use Python stdlib only. NoneBot/OneBot packages are
application dependencies, not hidden requirements of the session or artifact
logic.

## OAuth, accounts, and renderer

An unbound user receives an OAuth URL from `bangumi.auth_start`; the browser
callback is handled by the existing Fastify API. Tokens stay encrypted in the
server DB and are not sent to Claude or QQ. Existing multi-account tools retain
account listing and explicit switching; account ownership remains principal
scoped.

Chromium is optional. Without it, MCP can still answer text requests and the
host treats renderer-unavailable results as text-capable responses. Install it
only for cards:

```bash
pnpm renderer:install
```

## Verification

No real Claude account is needed for the mandatory checks:

```bash
pnpm test:host
pnpm smoke:host
pnpm build
pnpm test:integration:host-built
```

The Python matrix exercises isolation, restart persistence, leases, resume,
timeouts, bounded output, artifact validation, safe diagnostics, and pending
confirmation continuation. The built TypeScript test launches the actual MCP
stdio entry and checks external identity and confirmation lifecycle; a
deterministic protocol fixture checks that render responses contain only an
ArtifactRef and no local path.
