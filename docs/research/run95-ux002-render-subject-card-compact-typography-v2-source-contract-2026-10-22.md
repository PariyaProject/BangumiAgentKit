# Run #95 UX-002 Compact Typography Agent/MCP Contract v2

Date: 2026-10-22
Frontier: OP-008, subject overview presentation.
Scope: one fixed, anonymous, synthetic `bangumi.render_subject_card` matrix cell.

## Why this is a new profile

The v1 profile (`render-subject-card-offline-agent-mcp-v1`) belongs to its earlier
epoch and remains historical. This profile uses a distinct subject ID, argument
profile, network mode, epoch, report path, evidence kind, and claim label. It
cannot consume or retry the v1 claim. The user approved the compact typography
direction shown in the three previews; this profile checks the new 0.75 default
without sending a scale override.

## Fixed request

- Profile: `render-subject-card-compact-typography-agent-mcp-v2`.
- Epoch: `run95-ux002-compact-typography-default-075-20261022`.
- Tool: `bangumi.render_subject_card` exactly once.
- Arguments: `{"subjectId":991902,"includeCollection":false}`.
- One allowed request: `GET https://api.bgm.tv/v0/subjects/991902`.
- The response is a local fixed synthetic Subject with Chinese, Japanese, and
  short English text, rating data, and no external image URLs.
- The tool must return its PNG artifact; the sanitized report stores only
  dimensions, byte length, and SHA-256, never image bytes or fixture rows.

## Boundaries

Only the fixed offline fixture is reachable. The profile does not use OAuth,
account or collection data, community endpoints, external APIs, external asset
resolution, writes, QQ, or TIM. The Codex runner exposes only the one registered
MCP tool and has shell access disabled.

This profile proves the Agent/MCP renderer matrix cell only. It does not claim
visual acceptance by itself, prove a system font is installed, or prove display
in QQ/TIM. Typography and layout acceptance is recorded separately by the full
render matrix and manual image review.
