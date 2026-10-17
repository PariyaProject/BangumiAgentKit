# Run #95 G06 subject-cast offline Agent/MCP matrix v2

## Scope

This profile can credit only the missing Agent/MCP matrix cell for
`bangumi.get_subject_cast`. G06 remains `PARTIAL`: a synthetic cast does not
answer the Girls' Last Tour cast/CV question or establish complete Bangumi
coverage. The accepted public API row remains separate and receives no credit
from this profile.

The prior `g06-cast-offline-agent-mcp-matrix-v1` profile used
`{subjectId:990804,limit:2}` and is terminal `INCONCLUSIVE`, no-report, and
`retryAllowed=false`. It must never be invoked again. V2 has a new profile ID,
permanent latch, fixed argument profile, and input `{subjectId:990805,limit:2}`.
The scenario claim `{subjectId:218707,limit:100}` is also spent and excluded.

## Tool and fixture contract

The tool catalog marks `bangumi.get_subject_cast` as `auth: none` and
`risk: read`. V2 executes exactly one local fixture request for the exact
anonymous `GET /v0/subjects/990805/characters` route, with no query, body, or
authorization. The fixture returns two synthetic character rows and synthetic
actor data; it never calls native `fetch` or Bangumi. Repeated, credentialed,
altered, or unexpected requests are denied and counted.

The one-tool server exposes only `bangumi.get_subject_cast` and uses the
registered fixed arguments. Its durable-in-memory summary must report one
allowed call, zero denied calls, `argumentMatch=true`, the exact profile and
argument hashes, successful result projection, and the exact one-request
fixture counters. The result projection contains only bounded counts and
coverage fields; it omits synthetic IDs, names, and rows.

## Agent/MCP acceptance

The Codex turn must complete with exactly one successful MCP tool event, the
fixed acknowledgement `G06_SYNTHETIC_CAST_MATRIX_EXECUTED`, no non-MCP tool or
shell event, no MCP error result, a valid exact-Candidate server summary, and
an unchanged Candidate/bundle. The Codex event summary's normalized tool key is
`name`; a missing CLI argument/result echo is accepted only when the closed
server summary independently proves the registered exact tool, arguments, and
successful result. Item-level Codex error counts are retained as bounded
diagnostics but do not independently invalidate a completed, otherwise exact
matrix-only turn. A failed turn, wrong or extra tool, mismatched server
summary, wrong acknowledgement, server rejection, or Candidate/bundle drift
fails closed.

The runner stores only enumerated checks, bounded counters, hashes, and an
Ed25519 receipt. It does not store prompts, answer text, raw JSONL, standard
output/error, synthetic names/IDs, source rows, or result payloads. Any claim
that reaches `CLAIMED` is final: `INCONCLUSIVE` has no report and
`retryAllowed=false`; only a Harness-accepted `REPORT_WRITTEN` disposition can
credit this single Agent/MCP row.

## Gates and limits

Before the one permitted invocation, Harness must report this profile as
`UNCLAIMED` and bind it to the active Run #95 Epoch, exact Candidate and current
master Base, seven successful exact-head CI checks, same-identity GPT-6 Luna
Max `PASS`, and the matching MCP bundle attestation. The runner rechecks these
gates immediately before invoking Codex and before writing a report. No profile
call occurs without those gates.

This is a local synthetic Agent/MCP matrix check only. It adds no G06 scenario,
public API, OAuth/account, community/HTML/private `/p1`, write, QQ, or TIM
evidence and makes no claim about live Bangumi cast coverage.
