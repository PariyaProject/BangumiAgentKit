# NoneBot2 + NapCat + Claude Code Host Bridge

This example is a reusable bridge for an existing NoneBot2 application. QQ
transport remains in NapCat/OneBot11 and the LLM remains Claude Code; the
BangumiAgentKit MCP server supplies identity-aware semantic tools, OAuth,
multi-account state, confirmation-gated writes, and optional image rendering.

```text
QQ user
  -> NapCat / OneBot11
  -> existing NoneBot2 process
  -> Claude Code (`claude -p`)
  -> BangumiAgentKit MCP (`bangumi`)
  -> semantic tools / OAuth / renderer
  -> structured response and ArtifactRef
  -> NoneBot text + image reply
```

The reference integration does not create a built-in LLM orchestrator, own
the whole NoneBot application, or register a priority-1 catch-all matcher.

## What is in this directory

- `bangumi_host/`: NoneBot-independent Python stdlib bridge.
- `bangumi_host/config.py`: validated paths, limits, MCP config generation,
  explicit Claude environment allowlist, and subprocess environment.
- `bangumi_host/identity.py`: external QQ identity mapping only.
- `bangumi_host/claude_cli.py`: bounded, timeout-safe `claude -p` execution.
- `bangumi_host/session_store.py`: separate `host-bridge.sqlite` sessions,
  pending summaries, TTL, and cross-process conversation leases.
- `bangumi_host/artifacts.py`: capability ID and PNG/expiry/path validation.
- `bangumi_host/service.py`: resume/retry/fail-closed orchestration.
- `bangumi_host/adapter.py`: generic `handle_bangumi_agent_message` entry point.
- `plugin.py`: optional explicit `/bangumi` matcher when NoneBot2 is installed.
- `response-schema.json`: strict Claude structured-output contract.
- `system-prompt.md`: host safety and tool-use instructions.
- `mcp.example.json`: illustrative absolute-path MCP configuration.

## Installation and first setup

From the repository root:

```bash
pnpm install
pnpm setup:local
pnpm build
```

`pnpm setup:local` creates the BangumiAgentKit `.env.local` and never runs as
an import side effect. Fill in OAuth values if browser account binding is
needed. Keep this file private.

For image cards, install Chromium separately:

```bash
pnpm renderer:install
```

The text path works without Chromium and reports renderer unavailability as a
text result. To support OAuth callbacks, start the existing API application
with the same data directory and encryption environment:

```bash
pnpm start:api
```

Authenticate Claude Code in the account that will run the NoneBot process. A
real Claude smoke can consume quota; CI uses the fake fixture instead.

## Host environment

The important bridge settings are:

| Variable                            | Default / meaning                                                 |
| ----------------------------------- | ----------------------------------------------------------------- |
| `CLAUDE_BIN`                        | `claude` executable or absolute path                              |
| `CLAUDE_WORKDIR`                    | stable Claude work directory; defaults below `BANGUMI_DATA_DIR`   |
| `CLAUDE_TIMEOUT_SECONDS`            | 75 seconds, bounded to a safe range                               |
| `CLAUDE_MAX_OUTPUT_BYTES`           | 2 MiB bounded stdout/stderr capture                               |
| `CLAUDE_MAX_TURNS`                  | 16                                                                |
| `BANGUMI_DATA_DIR`                  | `~/.bangumi-agent-kit` unless explicitly configured               |
| `BANGUMI_ARTIFACT_DIR`              | `<data-dir>/artifacts`                                            |
| `BANGUMI_ENV_FILE`                  | explicit absolute env file for the MCP child                      |
| `BANGUMI_MCP_CONFIG`                | generated absolute MCP config unless an existing file is supplied |
| `BANGUMI_RESPONSE_SCHEMA`           | this directory's strict schema                                    |
| `BANGUMI_HOST_SYSTEM_PROMPT`        | this directory's system prompt                                    |
| `BANGUMI_HOST_SESSION_TTL_HOURS`    | 168 hours                                                         |
| `BANGUMI_HOST_STRICT_MCP`           | `true`; isolates this host from unrelated MCP servers             |
| `BANGUMI_HOST_ALLOWED_TOOLS`        | `mcp__bangumi__*`                                                 |
| `BANGUMI_HOST_BUILTIN_TOOLS`        | `WebSearch,WebFetch`; exact Claude built-in tool allowlist        |
| `BANGUMI_HOST_CLAUDE_ENV_ALLOWLIST` | empty; explicit extra parent env names, never `*` or `BANGUMI_*`  |

When `BANGUMI_ENV_FILE` is set, runtime env loading uses this order while
never overwriting an existing process variable:

```text
existing process.env > explicit BANGUMI_ENV_FILE > cwd/.env.local > cwd/.env
```

The generated MCP definition uses server name `bangumi`, `node`, the absolute
`apps/mcp/dist/main.js` path, SQLite, the configured data directory, and the
explicit env file. It explicitly bridges the trusted external identity and
per-invocation confirmation grant with Claude's `${BANGUMI_*}` expansion. JSON
does not rely on shell expansion of `~`.

Claude receives a deliberately small environment: portable process values,
explicit Claude/Anthropic authentication values, and only names listed in
`BANGUMI_HOST_CLAUDE_ENV_ALLOWLIST`. `BANGUMI_ENV_FILE`, database URLs, token
encryption keys, OAuth secrets, and other `BANGUMI_*` server values stay in the
MCP server configuration or parent process and are not copied into Claude.
The optional allowlist is for operator-selected values such as
`AWS_REGION,AWS_PROFILE`; it must never be `*`.

The default Claude built-in tool profile is `WebSearch,WebFetch`. Bangumi MCP
tools are separately allowed by `mcp__bangumi__*`. Operators may explicitly
configure a power profile, but enabling `Bash`, `Read`, `Edit`, `Write`, or
other filesystem/shell tools gives Claude the OS user's corresponding
capabilities and is not a strongly isolated mode. The bridge never enables
`--dangerously-skip-permissions` or `bypassPermissions`.

Check the installation without exposing secrets:

```bash
pnpm doctor:host
```

The doctor verifies Claude and its required flags (`--output-format`,
`--json-schema`, `--mcp-config`, `--strict-mcp-config`, `--allowedTools`, and
`--resume`), the built MCP entry, strict response schema, directories, and
host session database. Chromium remains optional.

## Identity and isolation

NoneBot supplies external identity fields; it never supplies `prc_*` and never
passes a Bangumi token to Claude:

```text
provider       = qq
bot instance   = qq:{bot_self_id}
external user  = {qq_user_id}
private chat   = qq:{bot_self_id}:private:{qq_user_id}
group chat     = qq:{bot_self_id}:group:{group_id}:user:{qq_user_id}
```

The MCP server resolves those fields with `Storage.findOrCreatePrincipal()`.
The resulting internal principal is available only to server-side
`ToolContext`. The user component in a group conversation ID is mandatory:
two people in one group get separate Claude sessions, pending actions, and
Bangumi account bindings.

For direct standalone MCP development only, the legacy internal principal
environment can be enabled explicitly with
`BANGUMI_MCP_ALLOW_INTERNAL_PRINCIPAL_ID=true` in a non-production environment.
Production rejects `BANGUMI_MCP_PRINCIPAL_ID`, and the NoneBot host never uses
this compatibility path.

## Connecting an existing NoneBot2 project

### Level 1: call the helper from an existing matcher

Copy or reference `bangumi_host/`, then create one long-lived service in the
existing bot process:

```python
from bangumi_host.service import ClaudeHostService
from bangumi_host.adapter import handle_bangumi_agent_message

bridge = ClaudeHostService.from_env()

async def ask_bangumi(user_id, group_id, bot_self_id, display_name, text):
    result = await handle_bangumi_agent_message(
        user_id=str(user_id),
        group_id=str(group_id) if group_id is not None else None,
        bot_self_id=str(bot_self_id),
        display_name=display_name,
        message_text=text,
        service=bridge,
    )
    # result.response.text is public text; result.artifact_paths are local
    # handles for the adapter only.
    return result
```

Route only the messages your bot intends to delegate. Send
`result.response.text` as text and each validated `result.artifact_paths` item
as a OneBot image segment. Never serialize a local path into model-visible
data.

### Level 2: use the example matcher

Load `plugin.py` from the existing NoneBot project. If OneBot v11 is installed,
it registers only `/bangumi` (aliases `/bgm` and `/邦奇`) with `block=False`.
Existing commands and matchers remain responsible for all other messages.

### Level 3: copy the generic module

Copy `bangumi_host/`, `response-schema.json`, and `system-prompt.md` into the
existing bot package. Keep `plugin.py` or your own matcher as the only place
that imports NoneBot. The generic bridge requires only Python 3.11+ stdlib;
NoneBot and OneBot dependencies belong to the application.

## Sessions, restart, and concurrency

The bridge stores only Claude session ID, pending confirmation ID/summary,
timestamps, and safe error code in:

```text
<BANGUMI_DATA_DIR>/host-bridge.sqlite
```

This database is separate from the frozen Bangumi domain SQLite schema. It
uses WAL, busy timeout, TTL cleanup, an asyncio lock per conversation, and a
short SQLite lease for multiple host processes. It does not store transcripts,
OAuth secrets, Bangumi tokens, or Claude credentials. Restart preserves a
non-expired Claude session mapping; expired mappings affect continuity only,
not Bangumi bindings.

On an ordinary stale `--resume`, the bridge clears the stale ID and retries
exactly once as a new session. If a pending destructive confirmation exists,
it fails closed and asks the user to start that write again.

## Authentication and multiple accounts

An unbound user receives the URL from `bangumi.auth_start`; the user opens it
in a browser and returns to the same QQ conversation after the API callback.
Tokens remain encrypted in server-side storage and are never put into Claude,
NoneBot messages, artifacts, or logs.

The existing `auth_list_accounts` and `auth_switch_account` tools support more
than one Bangumi account for the same external principal. Account ownership is
checked by the server, and a different QQ principal cannot list, select, or
use another principal's accounts.

## Images and confirmations

Render tools return only an `ArtifactRef`, for example `art_abc123`, never a
filesystem path. Public artifacts are derived under `BANGUMI_ARTIFACT_DIR`;
private Dashboard artifacts use `art_p_<scope>_<nonce>` and are derived under
the trusted external principal's `private/<scope>` directory. The host verifies
metadata ID/mime type, expiry, size, and PNG signature, and ignores a metadata
`filePath`. A private artifact without the current principal scope, or from
another principal, is rejected. Invalid or expired images are dropped while the
text response remains available.

For a destructive or bulk write:

1. MCP returns `CONFIRMATION_REQUIRED` and the model presents its summary.
2. The host persists the confirmation ID and summary with the session.
3. The Host classifies the next message as `CONFIRM`, `CANCEL`, or `OTHER`.
   Only a deliberately recognized confirmation (for example `确认` or
   `confirm`) gets the pending ID as `BANGUMI_MCP_CONFIRMATION_GRANT` for that
   one Claude invocation. The grant is not stored as a session environment.
4. An unrelated or ambiguous message does not get a grant and does not receive
   a fresh copy of the pending ID. Claude memory of the ID is harmless because
   MCP rejects `_confirmationId` without the matching trusted grant.
5. `取消`/`cancel` is handled locally: pending confirmation is cleared, the
   Claude session ID remains, and no Claude invocation is needed.
6. On confirmation, Claude must repeat the exact same tool name and payload
   with `_confirmationId`.
7. MCP requires both the trusted per-invocation grant and the PendingAction
   checks for principal, bot, conversation, payload hash,
   expiry, and atomic single-use claim.

Wrong user, wrong bot, wrong conversation, changed payload, expired ID, and
replay all fail safely. `WRITE_RESULT_UNKNOWN` requires state inspection before
another write.

## Actual process model and persistent state

```text
NoneBot process
  -> Claude Code process
     -> Node MCP process
```

The Bangumi domain DB, Host session DB, renderer artifacts, and Claude's own
session files are separate state. Host session mappings and Bangumi bindings
survive a process restart according to their independent TTL/lifecycle rules;
in-memory asyncio locks do not.

## Common failures

- **Claude not found / missing flag:** run `pnpm doctor:host`, set an absolute
  `CLAUDE_BIN`, and upgrade Claude Code if a required flag is absent.
- **MCP entry/config failure:** run `pnpm build`; inspect the generated config
  path and use an absolute `BANGUMI_ENV_FILE`.
- **OAuth URL or auth error:** start the API with the same data directory,
  OAuth settings, and token encryption key as the MCP child.
- **Image unavailable:** text continues to work; install Chromium with
  `pnpm renderer:install` and retry the render request.
- **Session lost during confirmation:** do not reconstruct the write; start the
  operation again so MCP can create a fresh PendingAction.
- **Busy conversation:** a same-conversation request is already running; retry
  after it finishes.

## Verification without a real Claude account

```bash
pnpm test:host
pnpm smoke:host
pnpm build
pnpm test:integration:host-built
```

The fake executable covers new/resumed sessions, structured output, artifacts,
pending confirmation, invalid JSON, timeouts, bounded output, non-zero exit,
and missing sessions. The built integration uses the real MCP stdio protocol
for external identity and confirmation. No Claude subscription is required.

For a manual, quota-consuming smoke after authenticating Claude, use the
existing `smoke:claude-host` command and try search, a card render, account
status, OAuth start, and a write followed by `确认`.
