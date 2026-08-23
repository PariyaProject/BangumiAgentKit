# BangumiAgentKit Agent Instructions

BangumiAgentKit is governed by two active documents:

- [`docs/agent/PRODUCT_CHARTER.md`](docs/agent/PRODUCT_CHARTER.md) defines the
  product direction, quality bar, source philosophy, and protected product
  boundaries.
- [`docs/agent/HARNESS.md`](docs/agent/HARNESS.md) is the only canonical
  detailed execution-governance policy.

Before product work, read both documents and then the selected concise Goal
profile under [`docs/agent/goals/`](docs/agent/goals/). If the profile or active
GitHub control plane references an opportunity record, read
[`docs/product/opportunity-log.md`](docs/product/opportunity-log.md) as product
context, not runtime authority.

## Standing defaults

- Primary implementation model: GPT-5.6 Luna at `max`; `xhigh` is the only
  availability fallback.
- Generic implementation/research subagents: `0` unless the user explicitly
  authorizes a specific use or an applicable skill requires it.
- Normal reviewed Epoch: one comprehensive Sol reviewer expected, two launches
  maximum, sequential only. Sol uses `high` reasoning by default.
- Autonomous outer run: four Sol launches maximum.
- Normal successful Product Epochs automatically integrate after PASS or the
  governed exhausted-budget Luna final-corrective gate.
- Product runtime state lives in one Outer Run GitHub Issue and one Epoch
  GitHub PR, never in tracked repository runtime files.
- Autonomous Goal entry runs `pnpm harness discovery:check` before `run:start`;
  unchanged exhaustion creates no Run Issue and spends no Sol.
- Never use Git worktrees.

These are entry-point reminders, not a second execution policy. Definitions,
state transitions, budgets, Candidate/CI invariants, parking, integration, and
failure behavior are owned solely by `docs/agent/HARNESS.md`.

## Repository safety

Never automatically commit, stash, reset, rewrite, or relocate unrelated user
work. Preserve unrelated dirty files untouched. If a required branch operation
cannot be performed safely, record the blocker in the GitHub control plane and
stop.

Never force-push shared history, create release tags, publish packages, or
cross a protected human-only boundary without explicit authorization. Product
Epochs use one ordinary branch and one PR. Parked work resumes on that same
branch and PR unless the user explicitly authorizes an exceptional replacement.

Normal V3 Product Epochs must not modify:

- `docs/product/loop-status.md`
- `docs/product/cycles/**`
- `docs/product/reviews/**`

Run `pnpm harness candidate:check` before review and let CI run the deterministic
legacy-runtime-path guard. GitHub control-plane unavailability is
`CONTROL_PLANE_UNAVAILABLE`; it never authorizes a tracked-file fallback.

## Code navigation

When `.codegraph/` exists, use CodeGraph before grep/find or broad file reading
to understand or locate code. The shell fallback is:

```text
codegraph explore "<question or symbols>"
```
