# Run 89: bounded subject-staff Agent/MCP evidence

## Scope and exact source

This Epoch advances G07, G17, and OP-005 by making the existing public
`bangumi.get_subject_staff` result readable by a text-only Agent within the
current 3,600-byte MCP text bound. The probe used candidate
`c13fcff7a4c0073299581afb1814555439812aae`, the matching 96-tool catalog hash
`26672c59d62f41910457fcee14f7925c615b17ff6ff658cac0e3ca053a02e08e`, and
Antigravity CLI 1.2.14. It requested subject 218707 with limit 200 through an
isolated public-only MCP allowlist. The sanitized machine report is
[`pariya-agent-full-public-qa-e2e-get-subject-staff-2026-10-04.json`](../live-probes/pariya-agent-full-public-qa-e2e-get-subject-staff-2026-10-04.json).

The CLI succeeded and completed exactly one Bangumi tool call. The visible
JSON text result was 3,529 UTF-8 bytes. Its source coverage reported 157 of 157
production-staff rows and 7 of 7 cast rows returned without source truncation.
The bounded text projection exposed 30 role groups and 30 member identities;
it marked 15 groups, 127 staff-group memberships, and all 7 cast items as
omitted from text. The corrected answer checker verified four explicit
returned role/name associations, bounded-coverage wording, and an explicit
statement that omitted or unobserved roles do not prove absence. It found no
unsupported completeness claim or Markdown formatting.

The first review found that the original checker counted role and name strings
independently, allowing swapped or unrelated mentions to pass. The sanitized
report binds the bounded-positive-statement checker by SHA-256. It recognizes
only direct role-first and name-first declarations, and rejects disavowal in the
local clause, a disavowing parenthetical, or a sentence-level correction. Its
focused regressions reject swapped, unrelated, negated, partial-substring, and
all four reproduced false-positive forms; they also cover literal raw labels
with regex metacharacters. Only counts, flags, and the checker hash are stored.
The replacement public call used the exact c13 source and 96-tool catalog
binding.

The report keeps only public raw role labels, counts, tool/schema metadata, and
boolean answer checks. It contains no prompt, answer prose, or person names.
The deterministic presenter regression separately verifies that the complete
`structuredContent` remains unchanged while the text view is compacted.

## Six-lane review

1. **Recorded opportunities and remediation.** OP-005 already identifies
   Subject Staff Intelligence as a high-value use of official-v0 subject
   credits. This result advances the existing read path and preserves raw
   relation labels; it adds no new source or role taxonomy.
2. **Capability maturity and user journey.** G07 and G17 can now receive an
   answer from a single Agent-facing staff tool. Only rows visible in the
   bounded text can support the answer. The checker requires a positive local
   role/name statement and rejects negation before or after that relation,
   parenthetical disavowal, and sentence-level correction. Source-level
   retrieval completeness does not turn omitted text groups into a complete
   displayed list.
3. **Agent UX and orchestration.** The isolated Agent used exactly one
   `get_subject_staff` call with the requested subject and limit. Its response
   tied four returned people to their raw role labels and stated the omission
   limit without another Bangumi tool call. The bounded-statement checker
   returns no answer text or person names and has exact regressions for all
   four reproduced disavowal forms.
4. **Renderer and Standalone quality.** This change does not alter either
   surface. Prior overview-card and Standalone evidence remains separate; this
   report does not claim current QQ or TIM rendering.
5. **Truthfulness and resource bounds.** The MCP text stayed below 3,600 bytes,
   retained staff and cast coverage, and exposed omitted-group/member/item
   counts. The answer did not infer that an omitted role is absent. The tool's
   `complete` state describes the bounded source response at limit 200; it is
   not a claim about every possible Bangumi credit or about every item fitting
   in the text projection.
6. **Architecture, maintenance, and testability.** The implementation reuses
   the existing MCP result-presenter seam and changes neither the tool schema
   nor source requests. A 100-row, 22-role, multibyte fixture was red at 69,440
   bytes before the fix and now asserts the 3,600-byte bound, retained raw
   labels/identities, omission semantics, and unchanged `structuredContent`.
   The sanitized live report is included in the integration acceptance test.

## Status boundary

G07, G17, and OP-005 remain **PARTIAL**. The text omitted 15 of 45 role groups,
127 staff memberships, and all 7 cast items. A bounded answer cannot establish
that an unshown credit does not exist. This is isolated Agent/MCP evidence only;
QQ/TIM, authenticated tools, and real-account paths were not exercised.
