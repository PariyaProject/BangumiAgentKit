# Run #95 C01: rating-count difference source contract

Checked 2026-10-15 against BangumiAgentKit Base `7248c774b2bc46a8d51b4ed20eb1ccc071d769c9` and the current first-party Bangumi v0 OpenAPI revision `65d29cff2331e08c0110d30d515f7f1b6488f845`. C01 remains `UNASSESSED` until its current, bounded Agent/MCP profile produces an accepted report. This source review made no Bangumi API/MCP, account, community, QQ, or TIM call.

## Supported answer

- `bangumi.get_subject_comparison` accepts exactly two distinct known subject IDs and returns current official-v0 facts. Its `ratingTotal` metric contains the ordered source values and a signed `B − A` delta. The metric is complete only when both values are finite and compatible; unknown or conflicting source values suppress the delta.
- Official v0 defines `Subject.rating.total` as an integer. The public source contract has not changed since the cited OpenAPI commit.
- A numeric gap can be reported with its direction and current-snapshot scope. The tool defines no absolute or relative threshold for “large enough,” and no statistical test, confidence interval, or significance conclusion. Without a caller-provided threshold, the answer must leave practical sufficiency undecided and must not call the difference statistically significant.
- The tool compares two supplied IDs; it does not discover a representative pair, establish a population baseline, or show that the result is unusual among similar works. Its other metrics and bounded cast/staff/relation sections are outside this C01 answer.

## Fixed one-shot profile

The new Run #95 C01 profile is limited to one anonymous call to `bangumi.get_subject_comparison` with `subjectIds=[41529,46729]`, `maxCast=1`, `maxStaff=1`, and `maxRelations=1`. These IDs were used by a historical direct-public ToolRegistry probe (`docs/live-probes/public-tools-2026-09-23-195936339-11159.json`); that report establishes neither current values nor a C01 Agent/MCP answer. The new profile is separately registered, bound to the exact Candidate/Base/reviewer/bundle, and permanently no-retry. It has not been invoked during this implementation Epoch.

The exact Base comparison of `packages/tools/src/definitions/read-tools.ts`, `packages/tools/src/subject-comparison.ts`, and `packages/bangumi-core/src/models/subject-comparison.ts` against `779d73451107e6d119825dd48d236ceb57f319e1` found no change to the C01 comparison implementation or metric model. The only change in `read-tools.ts` since that source-contract base adds chronology options to the separate `get_person_profile` tool.

## Disposition

C01 remains `UNASSESSED` in the implementation Candidate. After the gated one-shot, it may become `PARTIAL` only if the current source result and Agent answer agree on both IDs, names, rating totals, and signed delta, and the answer refuses unsupported threshold/significance claims. It remains `PARTIAL` because one pair cannot answer population-level significance or define a general threshold.

Primary references: [Bangumi v0 OpenAPI](https://github.com/bangumi/api/blob/65d29cff2331e08c0110d30d515f7f1b6488f845/open-api/v0.yaml#L3645-L3660), [comparison tool and limits](https://github.com/PariyaProject/BangumiAgentKit/blob/7248c774b2bc46a8d51b4ed20eb1ccc071d769c9/packages/tools/src/definitions/read-tools.ts#L260-L312), [metric construction](https://github.com/PariyaProject/BangumiAgentKit/blob/7248c774b2bc46a8d51b4ed20eb1ccc071d769c9/packages/tools/src/subject-comparison.ts#L403-L438), and [C01 scenario](https://github.com/PariyaProject/BangumiAgentKit/blob/7248c774b2bc46a8d51b4ed20eb1ccc071d769c9/docs/research/user-scenario-catalog.md#L62-L62).
