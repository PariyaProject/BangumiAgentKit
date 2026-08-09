# PR-7D Person / Seiyuu / Staff Intelligence

Status: PLANNED

Base: `9ae07d5a8ad5517da5dc9c33a999e174e71a86c9` (PR-7C implementation freeze)

## Cycle title

Person / Seiyuu / Staff Intelligence — official-v0 activity profiles and staff views

## User value

Bangumi exposes person pages, role lists, work lists, and collaboration views, but the
current AgentKit only exposes a shallow `bangumi.get_person` response (20 related
subjects and 20 related characters) and has no semantic staff view or person renderer.
This cycle makes a common person question answerable in one bounded, evidence-bearing
call:

- “这个人是谁，参与过哪些媒介和职位？”
- “这位声优配过多少角色/作品，主角和配角分别多少？”
- “这部作品的导演、脚本、音乐和声优分别是谁？”

The cycle deliberately does not claim recent activity, workload trends, or growth.
The official person relationship endpoints do not carry air dates, and the repository
has no compatible historical snapshots. Those questions must remain explicitly
`not_computable` or be logged as a later opportunity rather than inferred from API
ordering.

## Ten representative questions

1. 水濑祈是谁？她的 Bangumi 职业和基础身份信息是什么？
2. 水濑祈参与过哪些媒介，作品/角色关系数量如何分布？
3. 水濑祈最常见的角色关系标签是什么？
4. 水濑祈有多少个去重后的角色和作品关系？
5. 她的角色关系中主角、配角、客串和未知分别是多少？
6. 这位导演参与过哪些职位？每个原始 Bangumi 职位标签有多少条关系？
7. 少女终末旅行的制作人员按职位如何分组？
8. 这部作品的声优和制作人员能否在一个结构化结果中区分？
9. 能否给这个人物生成适合 QQ/Discord 的紧凑履历卡？
10. “这位声优最近半年是不是特别忙？”在没有作品日期/历史快照时能否明确说明不可计算？

## Current capability and parity audit

Live read-only audit of `https://bgm.tv/person/10868` and its `/works/voice`,
`/works`, and `/collabs` tabs (2026-08-10) observed:

- a profile header with image, aliases, career, identity fields, and summary;
- a role listing with media counts and role-position counts;
- a work listing with date, role, ranking, pagination, and sort controls;
- a collaboration page with co-occurrence counts and shared subjects.

Official v0 probes for person `10868` returned 335 related subjects and 319 related
characters. The subject relationship payload contains `id`, `type`, `staff`, `eps`,
names, and image; the character relationship payload contains character and subject
IDs/names plus `staff`. Neither relationship payload contains an air date or an
authoritative “recent” ordering. The cycle will preserve those facts in coverage and
limitations.

## Product gap

- `bangumi.get_person` calls the correct detail/relationship endpoints but truncates
  each relation list to 20 and does not aggregate media/role counts.
- There is no semantic `get_subject_staff` tool even though v0 exposes
  `/v0/subjects/{subject_id}/persons` with a raw `relation` label.
- Raw relation labels and numeric media types are not grouped for Agents.
- Standalone has no direct `person` command and the renderer has no PersonProfile view.
- Existing renderer view models do not expose coverage, evidence, formula, or
  not-computable states for derived person information.

## Sources and authority

Primary source: official Bangumi v0 API (S1), through the existing generated OpenAPI
client and transport:

- `GET /v0/persons/{person_id}`
- `GET /v0/persons/{person_id}/subjects`
- `GET /v0/persons/{person_id}/characters`
- `GET /v0/subjects/{subject_id}/persons`

Derived layer: deterministic local aggregation (S7). No new provider, HTML access,
cookies, Structured Web enablement, snapshot store, or write authority is needed.

## Proposed semantic capabilities

### `bangumi.get_person_profile`

Input:

- `personId` (required positive integer)
- `includeCredits` (optional, default `true`)
- `maxSubjects` and `maxCharacters` (optional, bounded; default 500, maximum 500)

Output:

- person identity and career fields;
- observed subject and character credit rows, capped with explicit truncation state;
- unique subject/character/credit-row counts;
- deterministic counts grouped by numeric media type and exact raw `staff` label;
- `coverage` with fetched/returned counts, limits, missing fields, and state;
- `evidence` naming the three official v0 operations and the S7 formula version;
- `limitations` stating that relation payloads do not support air-date windows,
  recent ordering, collaboration counts, or historical growth.

The tool must preserve raw labels and IDs. It must deduplicate only by stable IDs for
unique counts; credit rows remain visible so multiple roles on one subject are not
silently erased.

### `bangumi.get_subject_staff`

Input:

- `subjectId` (required positive integer)
- `limit` (optional, bounded; default 100, maximum 200)

Output:

- subject identity reference;
- staff rows with person identity, raw relation, `eps`, and image;
- groups keyed by exact raw relation label, preserving an `未知` bucket only when the
  source relation is empty;
- observed/partial coverage and official v0 evidence.

## Analytics contract

Formula version: `person-activity-v1`.

- `creditRows`: number of source relationship rows returned.
- `uniqueSubjects`: count of distinct `subjectId`/subject `id` values.
- `uniqueCharacters`: count of distinct character IDs.
- role/media distributions: deterministic group counts over source rows; no inferred
  role normalization beyond stable labels and numeric v0 media types.
- `coverage.state = partial` if a configured cap truncates a source list; no total is
  fabricated when the API does not provide a total.
- `not_computable`: date-window, recent, trend, growth, and collaboration-count claims
  that require fields or snapshots not present in this cycle’s sources.

## Evidence and failure states

The result must distinguish:

- `complete`: all requested source rows fit within the configured caps;
- `partial`: a cap was reached and the returned rows are not the full relation set;
- `not_computable`: a requested time-window/trend interpretation lacks required data;
- `unavailable`: an official endpoint failed and the public error is preserved.

Evidence must include source class (`official-v0` or `derived-s7`), operation/path,
retrieved-at, and formula version for derived distributions. No HTML fallback is
allowed.

## Agent UX

- Tool names and descriptions use user-question language and explain when to use the
  capability versus `bangumi.get_person`/`bangumi.get_subject`.
- Numeric media types are returned with stable labels (`book`, `anime`, `music`,
  `game`, `real`, `other`) while raw values remain available.
- Exact source labels are preserved; an Agent can quote the Bangumi relationship
  rather than relying on a guessed role taxonomy.
- Limits, partial coverage, missing date fields, and non-computable window questions
  are explicit and machine-readable.
- Standalone gains `person <id>` and `render person <id>` paths; generic `tool describe`
  exposes the full schema.

## Renderer opportunity

Add a bounded `person-profile` card using the semantic profile result:

- identity header with image fallback, names, and career chips;
- compact KPI row for unique subjects, credit rows, characters;
- media and role distribution summaries;
- a short list of representative subject/character credits;
- a clear partial/limitation footer when dates or historical workload are unavailable.

The renderer must not fetch data or perform analytics. The view model carries already
aggregated fields and preserves coverage/limitation text for human-readable output.

## Tests and QA

- unit tests for media/role grouping, stable-ID dedupe, unknown labels, caps, and
  partial coverage;
- semantic tool tests for request paths, three official person requests, subject staff
  mapping, input validation, and public error behavior;
- contract/typecheck tests covering new model and tool schemas;
- standalone command tests for `person` and `render person` routing;
- renderer tests for missing image, long CJK names, sparse credits, dense credits, and
  partial/not-computable state;
- real-user QA with person `10868` and a sparse/unknown fixture;
- Agent QA using “who is this person?”, “what roles/media?”, and a recent-work question
  that must be rejected as not computable;
- visual QA at representative 960px output and mobile-readable density, inspecting
  typography, long names, fallback imagery, distributions, and partial-state copy.

## Resource and security limits

- official v0 only; no cookies, HTML, Structured Web, new credentials, or write calls;
- at most one detail + two relationship requests for a person profile and one request
  for subject staff;
- output caps are enforced before serialization/rendering;
- no public/shared cache changes and no private data;
- preserve existing SSRF-constrained asset resolution for optional person images;
- no database migration or frozen public contract removal.

## Acceptance criteria

1. Both semantic capabilities are registered in curated and full tool listings and have
   valid Zod/JSON schemas.
2. `get_person_profile` answers static person/media/role/credit questions in one tool
   call with official evidence, stable-ID counts, and honest coverage.
3. `get_subject_staff` groups source roles without discarding raw labels or IDs.
4. Existing `bangumi.get_person` behavior remains backward compatible.
5. Standalone routes and renderer output are covered by tests.
6. No date-window or growth claim is emitted without date/snapshot evidence.
7. Required local validation, user/Agent QA, and representative visual QA pass.
8. The implementation candidate is independently reviewed by both required reviewers;
   the cycle is frozen only after exact-SHA CI and both `PASS` verdicts.

## Freeze gate

- implementation Candidate SHA recorded before review artifacts;
- mandatory CI green on that exact SHA;
- `sol_code_reviewer = PASS`;
- `sol_product_reviewer = PASS`;
- no unresolved P0/P1 blocker and no protected human-only boundary crossed;
- review artifacts and governance updates committed separately as the Governance Record.

## Deferred opportunities

- `VoiceActorWorkload` with 3/6/12-month air-date buckets (requires bounded subject
  hydration or a first-class activity source and explicit missing-date policy);
- current/recent work ordering matching the HTML person page;
- collaboration counts and shared-subject graph;
- PersonWorkload renderer with monthly comparison;
- historical trends, which require compatible snapshots.
