# Run 95 P01 director-filter offline matrix contract

## Purpose

This is a new synthetic Agent/MCP matrix profile for the registered `bangumi.get_person_activity` tool. It exercises the exact `staffRole=director` filter branch and can support at most this one matrix cell. It does not assess the P01 real-person role-frequency question, a real person's career, source completeness, or role absence.

## Fixed call and fixture

The registered call is fixed to one synthetic person, `kind=staff`, `staffRole=director`, `media=anime`, a 36-calendar-month window, `maxRelations=3`, `maxSubjectDetails=1`, and `maxRows=1`. The local fixture returns exactly three person-subject relations: one exact director label, one nonmatching label, and one empty/missing label. The service is expected to classify one match, one nonmatch, and one unknown label, then fetch detail only for the matching subject.

The fixture permits only three ordered `GET` requests to the local API client boundary: the fixed synthetic person, that person's subjects, and the one matching subject detail. It denies any other origin/path/method, query string, repeated call, authorization header, write, or unexpected request. No live Bangumi request, OAuth/account/community access, QQ, or TIM action is part of this profile.

## Source boundary

The implementation uses the official public-v0 person and related-subject shapes already documented by the repository's source audit. The person-related subjects endpoint is an unpaged array with no total or completeness indicator; this profile therefore makes no claim about omitted real-world relations. Its `staff` value is treated as the raw relation label, and only the service's explicit director label allowlist is positive evidence. A missing label remains unknown.

Source audit: `docs/research/run95-fresh-agent-mcp-frontier-audit-2026-10-23.md`. The service contract and exact label allowlist are in `packages/bangumi-core/src/services/person-activity-service.ts` and `packages/bangumi-core/src/models/person-activity.ts`; API route definitions are in the pinned Bangumi OpenAPI source referenced by that audit.

## Acceptance boundary

The sanitized report must bind the exact registered profile and argument hash, selection evidence hash, Candidate, current Base, exact-SHA seven-check CI run and checks, same-identity GPT-6 Luna Max review, MCP bundle, one exact MCP call, signed runner receipt, and fixture counters. It must not retain raw source rows, tool result, prompt, answer text, event stream, credentials, or artifacts.

Only a validated `REPORT_WRITTEN` disposition can credit `bangumi.get_person_activity` in the Agent/MCP matrix. P01 remains UNASSESSED. Any failed one-shot is terminal `INCONCLUSIVE`, with no report, no credit, and `retryAllowed=false`.
