# Autonomous Frontier Audit — Run 56 — C12 Subject/Index Membership

Date: 2026-08-30 (Asia/Tokyo)

Audited target: synchronized `master` at `6bf814e51e96d68b83279b1ea980493a95ae9e76`

Policy: `harness-v3.2-frontier-closure-v1`

## Selection

The canonical frontier ledger had 99 actionable records when Run 56 began. The
six required discovery lanes were reviewed against the current tools, core
services, renderer registry, Standalone registry, recent Epoch PRs, and the
existing research notes. Most high-value candidates in identity, revisions,
series order, collection intelligence, statistics, cast/staff integrity, and
person activity had already been implemented or remained dependent on broader
source coverage.

C12 remained an unimplemented user journey: “某作品有哪些推荐目录和主题索引？”.
The current product had a general `bangumi.get_index` read for a known index,
but no evidence-bearing way to ask whether one known subject appears in a
finite set of known indexes. The upstream site exposes subject-side directory
links, but the available official v0 contract does not provide a safe reverse
“all indexes for subject” operation. Broad HTML, `/p1`, and Structured Web
enumeration was rejected under the protected broad-web boundary.

## Scope salvage

Selected narrowed question:

> Given one known subject ID and 1–8 caller-supplied index IDs, which supplied
> indexes contain the exact subject ID, which were completely scanned without a
> match, and which remain unknown because the scan was bounded or unavailable?

The implementation uses only `GET /v0/indices/{index_id}/subjects`. It scans
sequentially with caller-visible caps for index fanout, page size, page count,
rows, and response bytes. Only an exact numeric `data[].id` match is positive.
`not_matched_in_observed_scope` is emitted only after the supplied index has
been fully exhausted; page caps, row caps, parser failures, upstream failures,
and not-found indexes remain `unknown`.

The result carries per-index state, pagination and row coverage, truncation and
failure reason, source operation, retrieval time, stable-ID evidence, and
limitations. The Agent tool, image-free Renderer card, and Standalone command
preserve these distinctions. The capability does not enumerate unknown index
IDs, fetch HTML or community pages, return comments/descriptions, use account
credentials, or perform writes.

## Rejected adjacent candidates

- Reverse discovery of every recommended directory was not implementation-ready
  because the safe official v0 surface lacks a subject-to-all-indexes operation;
  the finite known-index membership salvage is partial C12 only.
- Directory descriptions, comments, tags, and richer community text were not
  required to answer the narrowed stable-ID question and would cross the
  protected broad-web/raw-community boundary.
- Exact revision diffs, collection history, and broader person-work history
  were not selected because their current source contracts still provide only
  bounded observations or incomplete historical semantics; they remain in
  their existing frontier records.

## Evidence after implementation

- Core contract: `packages/bangumi-core/src/models/subject-index-membership.ts`
  and `packages/bangumi-core/src/services/subject-index-membership-service.ts`.
- Agent surface: `bangumi.get_subject_index_membership` in
  `packages/tools/src/definitions/read-tools.ts`.
- Presentation surface: `bangumi.render_subject_index_membership`,
  `SubjectIndexMembershipViewModel`, and the image-free card in
  `packages/renderer/`.
- Standalone surface: `subject-index-membership` plus `render
subject-index-membership` in `apps/standalone/`.
- Focused tests cover positive match, complete observed-scope non-match,
  incomplete-scan unknownness, upstream failure, input bounds, tool routing,
  HTML rendering, and human presentation.

Ledger disposition: `PARTIAL`. The bounded known-index question is now
implemented; the original “all recommended directories” question remains
open and must not be inferred from a finite supplied-index scan.
