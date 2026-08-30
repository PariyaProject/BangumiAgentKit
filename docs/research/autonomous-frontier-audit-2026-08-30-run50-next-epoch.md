# AUTONOMOUS_EVOLUTION Run #50: safest next Product Epoch

Research-only sidecar, audited 2026-08-30 (Asia/Tokyo).

- Audited synchronized baseline: `master...origin/master`, clean when inspected before this note was written; the audited `HEAD` is unchanged at the SHA below.
- Current `HEAD`: `5b3417dc9e5a383618dbc388f3218cc55b5d952d` (`Merge PR #49 epoch-subject-latest-revision-evidence-v1`).
- Scope: inspect and recommend; no reviewer, Product Epoch, GitHub control-plane, frontier-ledger, opportunity-log, Harness-runtime, code, or test change was made. This Markdown note is the only new file.
- Final verification found the checkout on `codex/epoch-person-activity-window-comparison-v1` with a pre-existing modification to `packages/bangumi-core/src/models/person-activity.ts`; that work was preserved untouched.

## Executive recommendation

Recommend the next Product Epoch as:

> **Bounded current-account collection entity consistency v1** — for a consenting, authenticated current Bangumi account, join a bounded sample of collected subjects with the account's collected characters and persons using official v0 stable IDs, and report positive links plus explicit observed-scope gaps.

This is the highest-value safe seam left in the inspected frontier. It closes the concrete L07 journey — “我的角色和人物收藏是否与我的作品收藏一致？” — without pretending to prove a global consistency property. The repository already has each raw read independently, but no semantic call that answers the cross-collection question. The source supplies the required IDs and relation edges; the implementation can be bounded to a small number of paged collection reads and a capped set of relation reads; and the result can remain private to the authenticated principal.

The recommended semantics are **positive evidence first**:

- “This collected character/person is linked to this observed collected subject” is a supported claim when the official relation payload contains the stable ID.
- “No link exists” is not supported when collection pages, entity lists, or relation arrays were capped, failed, private, schema-drifted, or otherwise incomplete.
- The user-facing negative label should therefore be **unmatched in observed scope**, not “inconsistent,” unless every relevant bounded source was fully observed.

## What changed since the existing research

I read the existing research before reassessing the frontier, especially [the 2026-08-30 audit](./autonomous-frontier-audit-2026-08-30.md), the [person source map](./pr7a2/person-source-map.md), [user source map](./pr7a2/user-source-map.md), [scenario coverage](./pr7a2/scenario-source-coverage.md), [community research](./community-data-research.md), [analytics design](./analytics-design.md), and the canonical IDs in the [frontier ledger](../product/frontier-ledger.json). The prior same-day audit was written against `65fde83` and recommended Subject Identity & Metadata v1. That recommendation is now stale: the current synchronized master contains the merged cohort comparison, subject identity, and latest-subject-revision epochs (`#46`, `#48`, and `#49`). The ledger and opportunity log were consulted only as context and were not updated.

The current baseline now includes:

- bounded subject identity and alias/infobox evidence;
- bounded subject cohort comparison;
- latest subject revision evidence, still explicitly partial rather than an exact before/after diff;
- bounded person activity and collaboration;
- current-account collection intelligence, backlog, schedule, dashboard, series grouping, and episode collection reads.

The remaining opportunities below are therefore judged against the current code, not the older research snapshot.

## Candidate comparison

| Candidate | User value | Source contract and resource shape | Privacy/auth and degraded semantics | Agent UX / Renderer fit | Disposition |
|---|---|---|---|---|---|
| **Current-account subject/character/person consistency (L07)** | High: joins three existing personal collection concepts into one answer. | Official v0 has paged subject collections, one-request character/person collection lists, and subject→characters/persons arrays. A conservative cap of 24 relation roots gives at most 8 subject pages + 2 entity-list reads + 48 relation reads, with relation concurrency ≤4 and a per-response byte guard. | Current account only; require `read:collection`; do not accept an arbitrary username in v1. Positive ID matches survive partial coverage; caps/failures become `partial` and suppress negative claims. | One semantic call can answer the journey. An image-free evidence card can show matched links, unmatched-in-observed-scope, coverage, raw relation labels, retrieval time, and warnings. | **IMPLEMENTATION_READY; recommend next Epoch.** |
| **Person activity/workload gap (G04/G05)** | High in principle, but the bounded current snapshot is already present. | `bangumi.get_person_activity` already bounds relations to 120, subject details to 48, rows to 60, and detail concurrency to 4; it uses `first_air_date` as the window key. | Public v0 person data needs no account. The honest boundary is “observed participation by release-date window,” not labor time, workload intensity, or historical growth. No v0 snapshot/event stream supports a retrospective comparison. | Agent and Renderer coverage already exist with explicit missing-date/media/role/detail-failure semantics and tests. | **Do not open a duplicate Epoch.** Keep current snapshot semantics; a cross-window history/workload comparison is **RESEARCH_READY**, requiring a separate local observation, retention, and consent contract. |
| **C12: subject → all index membership** | Medium/high for discovery, but the broad question is reverse lookup. | v0 exposes GET for a known index and paged subjects inside that index; it does not expose subject→indices discovery or a safe all-index enumeration. | Public index data is still community-authored content; comments/descriptions should not be injected into Agent context by default. | A tool requiring the user to supply index IDs is safe but has weak discovery UX; renderer can show positive membership only. | **Reject broad C12 as next Epoch.** A finite known-index membership check is an **IMPLEMENTATION_READY salvage**, lower value because the user must provide IDs. |
| **Exact latest-subject revision diff (C13)** | Medium: useful when available, but the current epoch already exposes bounded latest evidence. | Current v0 revision reads provide a latest revision observation; no trustworthy v0 before/after pair or complete field-level diff contract was found. | No privacy issue for public subject data; the correct result remains partial/not computable rather than an invented diff. | Existing latest-revision tool can expose “latest observed revision,” but not a semantic change narrative. | **Reject as next Epoch;** retain the current partial capability. |
| **Collection history, taste, or workload trends** | High user interest, but history is the missing fact. | `UserSubjectCollection.updated_at` is explicitly not collection time and may not change for rating/comment/episode updates. Current v0 reads are observations, not an event stream. | Historical private collection data needs explicit consent, principal-scoped storage, retention, and deletion semantics. | Current intelligence/dashboard already covers bounded present-state stats; trend renderer would overstate evidence without snapshots. | **Reject API-only implementation.** A local opt-in observation series is **RESEARCH_READY** under the statistics/history frontier. |
| **Community recommendations / `/p1` enrichment / HTML discovery** | Potentially high, but source and policy risk dominate. | No official v0-only contract closes the missing reverse discovery or recommendation surface; `/p1` and HTML are not a stable v0 contract. | Do not rely on private/internal endpoints, cookies, bulk mirrors, or crawler-like collection. | Untrusted community text also requires isolation from Agent instructions and renderer limits. | **No safe v0-only next Epoch.** Revisit only after an explicit source-contract and policy review. |

## Evidence for the recommended seam

### The product gap is real in the current tool surface

The current tools expose the ingredients separately:

- [`bangumi.list_collections`](../../packages/tools/src/definitions/read-tools.ts#L1439) reads subject collections with subject type, status, limit, and offset, and resolves an omitted username to the bound account.
- [`bangumi.list_character_collections`](../../packages/tools/src/definitions/read-tools.ts#L1253) and [`bangumi.list_person_collections`](../../packages/tools/src/definitions/read-tools.ts#L1346) read the two entity collection lists and report `observed/returned/truncated`; the checked-in service calls the upstream lists without query pagination and caps its returned observation at 50.
- [`bangumi.get_collection_intelligence`](../../packages/tools/src/definitions/read-tools.ts#L1561) and [`bangumi.get_collection_dashboard`](../../packages/tools/src/definitions/read-tools.ts#L1759) are already current-account-only and `read:collection`-protected, but their documented sections are present-state subject stats, backlog, schedule, and composition; neither joins collected characters/persons to collected subjects.
- [`bangumi.get_collection_series_groups`](../../packages/tools/src/definitions/read-tools.ts#L1855) joins collected subjects to subject-to-subject series relations, not to the account's character/person collections.
- [`bangumi.get_index`](../../packages/tools/src/definitions/read-tools.ts#L2039) takes a known `indexId`; its implementation calls `getIndexById` and `getIndexSubjects` and has no subject-to-index discovery input or output.

The underlying current-account and relation mapping is visible in [`UserService`](../../packages/bangumi-core/src/services/user-service.ts), including the paged subject collection and the character/person list methods. The generated client exposes the stable operations in [`packages/bangumi-openapi/src/generated/index.ts`](../../packages/bangumi-openapi/src/generated/index.ts#L151) and [`IndexReadService`](../../packages/bangumi-core/src/services/index-service.ts#L17) shows the known-index-only shape.

### Official v0 contains the necessary edges

The checked-in upstream contract and the official published contract agree on the relevant operations:

- [`GET /v0/users/{username}/collections`](../../openapi/upstream/v0.yaml#L1064) is paged, supports subject type/status filters, and says private collections require an access token.
- [`GET /v0/users/{username}/collections/-/characters`](../../openapi/upstream/v0.yaml#L1418) and [`.../-/persons`](../../openapi/upstream/v0.yaml#L1467) return the account's character/person collection records. Their schemas carry stable IDs, names, types, career labels for persons, and collection creation timestamps.
- [`GET /v0/subjects/{subject_id}/characters`](../../openapi/upstream/v0.yaml#L431) returns related characters, including a raw relation and nested actor records; [`GET /v0/subjects/{subject_id}/persons`](../../openapi/upstream/v0.yaml#L400) returns related persons, raw relation labels, careers, and episode/track participation text.
- The related rows are ID-bearing, so the join can be exact by ID. It must not fall back to name matching.

See the same operations in the [official Bangumi v0 OpenAPI document](https://github.com/bangumi/api/blob/master/open-api/v0.yaml), especially the [subject person/character paths](https://github.com/bangumi/api/blob/master/open-api/v0.yaml#L400-L460) and [user collection paths](https://github.com/bangumi/api/blob/master/open-api/v0.yaml#L1064-L1145). The official [developer page](https://bgm.tv/dev) describes the API as the intended data interface and lists subject/person/character metadata and relations as API-accessible data.

The useful caveat is also explicit in the official schema: [`UserSubjectCollection.updated_at`](../../openapi/upstream/v0.yaml#L3982) “does not represent collection time” and should not be relied on. The proposed consistency report therefore has no history claim and does not use collection timestamps to order events.

## Proposed v1 source contract and bounds

This is a recommendation for the next Epoch, not an implementation change.

### Scope

Use a new semantic read tool, tentatively `bangumi.get_collection_entity_consistency`, with:

- no `username` parameter;
- a bound authenticated execution session for the current account;
- required capability `read:collection`, read-only risk, and no writes;
- optional subject type/status filters;
- explicit caps such as `maxSubjectPages ≤ 8`, `maxSubjectRoots ≤ 24`, `maxRelationRowsPerRoot ≤ 80`, `maxOutputRows ≤ 60`, and total duration ≤ 60 seconds;
- deterministic output ordering by stable subject/character/person IDs after the bounded scan.

### Retrieval plan

1. Read the current account's paged subject collection until the page cap, source exhaustion, or the root cap. Preserve `sourceTotal`, pages attempted/succeeded, duplicates, stalled pagination, and any page failure.
2. Read the account's character and person collection lists once each. Preserve the upstream total and the fact that these list operations have no query pagination; if the response exceeds the semantic cap, report truncation.
3. Select at most 24 subject roots deterministically. If the account has more observed roots than the cap, report sampling/selection rather than implying the account was fully scanned.
4. For each selected root, read the official subject character and subject person arrays. Use a transport response-byte cap (the generated client already accepts `maxResponseBytes` for these subject relation operations), a semantic row cap, and concurrency no greater than four. These arrays are not paginated in the v0 contract, so both byte and row coverage are necessary.
5. Join only on stable IDs:
   - collected character ID ↔ subject related-character ID;
   - collected person ID ↔ subject related-person ID;
   - optionally, collected person ID ↔ nested character actor ID as a **separate `character-actor` evidence kind**, never silently reclassified as a direct subject-person credit.
6. Return the source relation label, source operation, subject ID, entity ID, and retrieval timestamp with each positive match. Do not return collection comments/tags or raw private subject fields in the default report.

Worst-case Bangumi reads after the authenticated client is available are approximately `8 subject pages + 2 entity lists + (24 × 2 relation arrays) = 58`, plus any one-time account identity resolution if the session does not already carry the username. A four-wide relation pool bounds concurrency; the total-duration and per-response byte caps prevent an unusually large relation array from turning the semantic call into an unbounded crawl.

### Result semantics

The result should distinguish:

- `matched`: positive ID-backed links observed in the selected subject roots;
- `unmatchedInObservedScope`: a collected character/person for which no link was found in the observed roots, explicitly not a global negative;
- `unknown`: roots or relation sources not observed because of caps, failures, visibility, malformed rows, timeout, or schema drift;
- `coverage`: per-source totals, pages, roots selected, relation rows observed/returned, truncation, failures, and sampling;
- `evidence`: official operation path and retrieval time for every claim;
- `limitations`: the exact reason a negative or completeness claim is unavailable.

Suggested state rules:

| Condition | Honest state/wording |
|---|---|
| No bound account or missing `read:collection` authorization | `auth_required`; do not fall back to a public username. |
| Token rejected or access denied | `permission_denied` / `unavailable`, preserving the upstream error boundary. |
| Account collection scan and both entity lists are complete, every selected relation source succeeds without caps, and output is not truncated | `complete`; “no match in the scanned account scope” is allowed for the selected roots only. |
| Any page/list/relation cap, sampling, timeout, failure, visibility gap, invalid row, or schema drift | `partial`; retain positive matches and label negatives `unmatched in observed scope`. |
| All candidate relation evidence is unavailable or unusable | `not_computable` rather than an empty consistency result. |
| Complete sources return no rows | `complete` with zero matches, not `not_found`. |
| Same stable ID has conflicting source labels or types | `conflict`; preserve both observations and do not merge by name. |

## Privacy, source, and trust boundaries

The official [Bangumi data-use agreement](https://bgm.tv/about/copyright) says applications should obtain user consent, use only data necessary for the stated function, and not transfer user data to third parties. The Epoch should therefore:

- make current-account scope and purpose visible before authorization;
- use the existing bound principal and `read:collection` scope, not a username supplied by the Agent;
- avoid comments, tags, private collection fields, images, tokens, and durable cross-principal caches in the default result;
- keep evidence and any generated artifact principal-scoped and short-lived according to the repository's existing privacy boundary;
- identify the application in API requests according to the official [User-Agent guidance](https://raw.githubusercontent.com/bangumi/api/master/docs-raw/user%20agent.md).

The v0 OpenAPI does not declare an explicit security block on the character/person collection-list paths, while the subject collection path declares optional bearer access and notes private-collection access. That is not a reason to downgrade the proposed tool to public/anonymous semantics: the product journey is about one user's private cross-collection view, so the new semantic surface should require the authenticated current-account contract consistently with the existing collection intelligence/dashboard tools.

## Agent UX and Renderer fit

The Agent should receive one semantic call rather than orchestrating three low-level list calls and an arbitrary number of relation reads. The tool description should say “bounded positive links and observed-scope gaps,” name the caps, and explicitly prohibit conclusions about unobserved subjects or platform-wide consistency.

A renderer can use the existing source → capability → view-model → renderer pipeline with an image-free layout:

1. scope header: current account, selected subject filters, observed/selected counts, retrieval time;
2. positive links: subject → collected character/person, raw relation label, and evidence kind;
3. observed-scope gaps: collected entities not linked in the selected roots;
4. unknown/partial section: skipped roots, failed relation reads, truncation, and the sentence “未观察到不等于不存在”; 
5. compact source and limit footer.

Business semantics should stay in the capability result, not in a template. No image hydration is needed for v1, which keeps the renderer deterministic and avoids turning an evidence report into a private media board.

## Rejected candidates and salvage variants

### Person activity/workload

The current [`bangumi.get_person_activity`](../../packages/tools/src/definitions/read-tools.ts#L992) is already a safe bounded snapshot: its description says it uses official v0 person relations and bounded subject details, preserves raw role labels, reports missing dates/media/roles and failure coverage, and does not claim labor duration or actual voice time. The service and tests make the bounds concrete in [`person-activity-service.ts`](../../packages/bangumi-core/src/services/person-activity-service.ts), [`person-activity.test.ts`](../../tests/unit/person-activity.test.ts), [`tests/semantic/person-activity.test.ts`](../../tests/semantic/person-activity.test.ts), and [`tests/render/person-activity.test.ts`](../../tests/render/person-activity.test.ts).

The remaining attractive question — “did this person do more work in one period than another?” — is not closed by v0. `first_air_date` is a release-date proxy, not a work-date or workload measure, and v0 supplies no historical snapshot series. The salvage is to retain the current wording, or separately research a consented local statistics-observation contract. Do not add a busy score, trend, or exact recent ranking as the next Epoch.

### C12 index membership

The official [index paths](https://github.com/bangumi/api/blob/master/open-api/v0.yaml#L1773-L1845) support a known `index_id` and paged subjects inside that index. They do not provide the reverse query “which indexes contain this subject?” The current [`IndexReadService`](../../packages/bangumi-core/src/services/index-service.ts#L17) and [`get_index`](../../packages/tools/src/definitions/read-tools.ts#L2039) mirror that known-ID shape.

Safe salvage: a future `check_subject_index_membership` may accept a finite caller-supplied set such as ≤8 known index IDs, read each index's bounded subject pages, and return only positive subject-ID matches. It must say “not found in the supplied observed indexes,” never “not in Bangumi indexes.” Keep index descriptions/comments out of Agent instructions by default because the source is user-authored community text. This salvage is implementation-ready but loses the discovery value of C12, so it ranks below collection consistency.

### Latest revision, history, and community data

The current latest-revision surface is a bounded latest observation, not a before/after diff; no Epoch should manufacture the missing prior state. Collection history needs local observation and retention semantics because the upstream timestamp is explicitly unreliable as collection time. Community/index discovery through private/internal or HTML surfaces would cross the Charter's source and privacy boundaries; the official [developer/API guidance](https://bgm.tv/dev) and [data-use policy](https://bgm.tv/about/copyright) support using provided interfaces, not crawler-like substitutes.

## Epoch acceptance gates if this recommendation is selected later

Before implementation, the candidate should be narrowed to the current-account, positive-ID, bounded contract above. Review fixtures should cover at least:

- complete three-source coverage with direct character and person matches;
- character actor matches separated from direct subject-person credits;
- empty collections with complete zero semantics;
- subject page exhaustion versus page cap/sampling;
- entity-list truncation and relation-array row/byte caps;
- one or more relation failures, timeout, malformed row, and stable-ID field conflict;
- missing authorization and denied private access;
- proof that partial results never emit a global “inconsistent” claim or leak comments/tags/tokens.

This note recommends the seam only. It does not start the next Epoch, launch reviewers, or change any runtime/control-plane record.
