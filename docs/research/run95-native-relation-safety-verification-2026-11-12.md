# Direct relation evidence versus safe viewing steps

At source base 9878d633, the next useful question is:

> 同一作品的前传／续集标签冲突，又有漫画原作和方向未知关系时，
> 哪些证据仍然可见，哪些能够进入动画观看顺序？

The shipped service already implements this distinction. This increment verifies
its actual native MCP behavior without changing the service, presenter or design.
It adds no model execution, profile, report, retry authority or acceptance credit.

## Why this is different

The [exact prior comparison](run95-native-relation-safety-prior-contracts-2026-11-12.json)
preserves argument objects, registry digest, source base and dated observations.
Nine registered relation/watch-order profiles were independently read through the
supported status command: all are terminal INCONCLUSIVE, both latches present,
no report and no retry. The already accepted render v2 profile remains
REPORT_WRITTEN and must not be repeated. Legacy R01 is also terminal with no
report; its exact global labels and PR147 disposition were read.

Legacy G20, S03 voice overlap and G09 answer contracts are included by their
pinned arguments and source. Current legacy PR104/110 state does not expose a
structured execution disposition; that observation is recorded as unknown,
not reconstructed from a merged PR or used as new authority. Historical S03
native voice proofs remain delivered. This work neither reconciles nor runs
those legacy entry points.

Rejected alternatives include new IDs for the old single/two-node R04 fixture,
another positive direct-response sample, repetition of two-hop rating analysis,
and testing an already accepted renderer or delivered voice branch. The material
difference here is the distinction between visible raw conflicting evidence and
safe derived steps, including media and direction exclusions over the same graph.
This is local source verification; no current upstream behavior was inferred.

## Finite native contract

createRelationSafetyMcpServer constructs the actual SDK Server, ToolRegistry,
generated provider, HttpClient, descriptors and normal MCP presenter. It exposes
only these ordered calls, once each:

    [
      {
        "toolName": "bangumi.get_subject_relations",
        "arguments": { "subjectId": 9632001, "includeEvidence": true }
      },
      {
        "toolName": "bangumi.get_series_watch_order",
        "arguments": { "subjectId": 9632001, "depth": 1, "maxNodes": 8, "media": "all" }
      }
    ]

Both calls use a closed synthetic graph. The direct response has five rows:

| Target         | Raw label(s)                     | Native viewing outcome                 |
| -------------- | -------------------------------- | -------------------------------------- |
| 9632002        | 前传                             | Before root 9632001                    |
| 9632003        | 前传 and 续集, two separate rows | Excluded: conflicting_direct_relations |
| 9632004, book  | 原作                             | Excluded: media_type_not_anime         |
| 9632005, anime | 相关作品                         | Excluded: relation_not_watch_step      |

The safe prequel returns a direct 续集 edge to the root. That reciprocal edge
remains evidence and does not cause another root traversal or duplicated step.
This is not a general cycle-detection claim.

The injected transport admits exactly five local GET responses in order:
root relations for the first call, then root detail, root relations, prequel
relations and prequel detail for the second. No live fetch fallback exists.
Changed paths/methods/query strings, bodies and credential headers are denied.
No detail or traversal request is made for the conflict, book or unknown target.
The auth, OAuth, audit and artifact services are disabled; no renderer is started.
The factory has no process, model, file, GitHub or service-control dispatch.

The native verifier checks both conflicting raw rows, source direction and
unknown completeness; the exact two viewing steps; all three exclusion reasons
and their directed paths; all six observed edges; source/detail counts; partial
state with semantic-conflict; and the noncanonical-order limitation. All native
facts come from executing the current tools against the fixed responses.

## MCP, failure and lifecycle proof

The normal compact text is at most 3600 UTF-8 bytes. In this fixture it can omit
a viewing step, related rows or exclusion samples, and explicitly counts those
omissions. The full structuredContent retains every step, label, path and
exclusion. A future Agent must read it; seeing compact text alone is insufficient
to claim that the full user question was answered.

The checks use the actual MCP SDK over both linked in-memory transports and a
separate stdio Node child. Wrong order, changed arguments, extra identity fields,
wrong tools, duplicates and overlapping calls permanently fail the instance.
Actual transport adversaries challenge a changed source path, token header,
pagination and write method, with a live-fetch tripwire. Additional cases cover
cancellation, deadline and close while native work is held, then release it and
verify that late source reads remain denied. Close drains admitted work, closes
owned resources and is idempotent.

The per-call deadline defaults to 20 seconds; a smaller validated test deadline
allows deterministic deadline coverage. Snapshot copies cannot mutate live
state. The first closed error code/stage survives later source rejection and
cleanup; raw errors, values, answers, titles or account identifiers are not
retained in that failure record. It is a native diagnostic, not a signed receipt.

The sole test worker is a synthetic stdio entry with a 20-second shutdown timer.
It does not consume any historical model claim. CI runs the new native test
explicitly after the normal build, alongside the unchanged native G03 checks.

## Reproduce and continue

After dependencies and the ordinary workspace build:

    node --test tests/integration/native-relation-safety.test.mjs

Sixteen cases pass locally, including eleven semantic-output mutations within
one case. The first draft of the new test used the wrong existing omission
field name and was corrected to relatedRowsOmittedFromText; the presenter
was unchanged. A throwaway initial probe also incorrectly rejected the
registry-owned renderer close hook; the production host has an explicit empty
close hook and does not construct a renderer. Neither was a shipped product bug.

This increment establishes native source/semantic/wire behavior only. Direct96,
public65, Agent86, account12, QQ0 and TIM0 remain separate evidence planes. R01
stays PARTIAL; R04's original required-film question stays UNASSESSED. It does
not prove a complete franchise, mandatory film placement, official order, live
public data, actual model comprehension or visual/aesthetic quality.

A future separately governed model contract can reuse this native factory after
the ordinary exact Candidate/Base/CI/reviewer/claim gates. Before execution it
must also prove retained diagnostic publication and lifecycle handling using
the delivered offline observation seam. That seam's current native-summary
parser recognizes G03 only: this new snapshot must not be silently labelled as
verified G03 evidence. No future execution is selected or authorized by this
document, and no old entry point is changed.
