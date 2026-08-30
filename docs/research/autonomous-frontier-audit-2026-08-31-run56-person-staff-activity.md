# Autonomous Frontier Audit — Run 56 — G16 Person Staff Activity

Date: 2026-08-31 (Asia/Tokyo)

Audited target: synchronized `master` at
`6338a33ece386fab26b8c2d2260315b702215026`

Policy: `harness-v3.2-frontier-closure-v1`

## Six-lane audit

- `recorded_product_opportunities`: The scenario catalog records G16 as the
  three-year director/TV-anime question. No separate opportunity or protected
  product direction supersedes it; the smallest valuable increment is a role
  filter on the existing person activity path.
- `capability_maturity_and_user_journeys`: The existing activity service reads
  current official person-subject relations and bounded subject details, but
  its public window stops at 12 months and it cannot select director rows.
  G16 therefore has a concrete implementation-ready gap.
- `agent_ux_and_discoverability`: `bangumi.get_person_activity` and its render
  counterpart already expose the relevant relation, media, window, cap, and
  evidence controls. Adding one documented enum and a 36-month literal keeps
  the user/Agent contract discoverable without inventing a second person tool.
- `renderer_and_standalone_experience`: The existing activity card and human
  presenter already show window, raw role, source operations, exclusions, and
  limitations. They need the role filter plus unknown/excluded role counts to
  keep a director result auditable on every surface.
- `correctness_evidence_and_resource_bounds`: Official role text is not a
  reliable basis for fuzzy inference. The safe scope is an exact normalized
  allow-list (`导演`, `監督`, `总导演`, `総監督`, and conservative English
  equivalents), with missing labels counted as unknown. Existing relation,
  detail, row, concurrency, and response-size caps remain unchanged.
- `architecture_maintenance_and_testability`: Extending the existing service
  preserves its date-window, media, stable-ID, and evidence seams. Focused
  service, semantic, render, Standalone, and contract checks can verify the
  new behavior without duplicating a data-fetching implementation.

## Candidate assessments

### G16 — selected

Source evidence: `docs/research/user-scenario-catalog.md` identifies the
person career/role, TV classification, and air-date requirements; the current
implementation is in `packages/bangumi-core/src/services/person-activity-service.ts`
and is already exposed by the Agent, Renderer, and Standalone surfaces.

Value hypothesis: A bounded answer to “which TV anime did this known director
participate in during the last three years?” is materially more useful than a
generic staff activity list and avoids claiming a complete career database.

Scope salvage: `IMPLEMENTATION_READY`. Use current official person-subject
relations, exact role labels, first-air-date calendar windows, and existing
bounded hydration. Positive rows are exact role observations; missing role
labels remain unknown and cannot support a complete negative claim.

Source contract research: `NOT_REQUIRED`. The existing official v0 relation
and subject-detail operations are sufficient for the narrowed observation; no
HTML, Structured Web, or authenticated source is needed.

### G04 — not selected in this Epoch

Source evidence: the existing person activity path already supports voice
relations, TV classification, recent calendar windows, deduplication, raw
roles, and bounded subject details. The scenario is close to delivered for its
12-month wording, but a separate audit is still needed before changing its
ledger status or broadening the window contract.

Disposition: `LOW_USER_OR_AGENT_VALUE` for this Epoch; preserve as an actionable
frontier record for an explicit closure audit rather than duplicating G16 work.

Scope salvage: `NO_SAFE_VARIANT` within this Epoch because the meaningful gap is
not independent of the person-activity contract being extended here.

Source contract research: `NOT_REQUIRED`; the current official v0 contract is
already used by the existing implementation.

### G17 — not selected in this Epoch

Source evidence: current subject overview/staff capabilities expose official
staff relation groups, but the full “原作、导演、脚本和音乐分别是谁” journey
also requires a deliberate mapping of source relation semantics and missing
group behavior. That is a subject-staff presentation question, not a person
career-window question.

Disposition: `LOW_USER_OR_AGENT_VALUE` for this Epoch; keep the subject-side
staff/source mapping as a separate candidate so G16 does not mix relation
semantics.

Scope salvage: `NO_SAFE_VARIANT` within this Epoch because the remaining work is
not independent of a future subject overview/source-contract decision.

Source contract research: `NOT_REQUIRED` for the selected work; G17 itself
remains open for its own source-contract audit.

## Selected bounded contract

The Epoch adds `staffRole=director` and a 36-calendar-month option to the
existing person activity contract. The filter runs before subject-detail
hydration, preserves the raw official role, reports excluded and missing-role
rows separately, and degrades completeness only for missing role labels or the
existing source/detail/output limits. It does not enumerate all directors,
infer roles from career text, claim historical employment, or estimate labor
time.

Ledger disposition: `PARTIAL`. The narrowed current official relation
observation is implementable and useful, while complete historical director
coverage remains unsupported by source scope and explicit resource bounds.
