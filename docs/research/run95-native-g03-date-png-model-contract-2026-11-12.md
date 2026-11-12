# Native G03 date and PNG model observation contract

This workload tests the usable-date correction delivered by PR294 and the
native verification boundary delivered by PR295, at base `610604a2`. Those
implementations stay delivered. Run95 retains the original all96 objective.

## User question and distinct scope

Can an Agent find animation in an explicit half-open date window with score
and rating-count cutoffs, retain the usable dates after detail hydration,
explain the unknown-date limitation, and obtain the matching native PNG?

All seven old query/render model profiles are spent and retain their original
definitions and terminal dispositions. The [exact contract comparison](run95-native-g03-date-png-prior-contracts-2026-11-12.json)
preserves their argument objects, source Candidate and registry digest. They
test title lookup, a single synthetic item, or a fresh public title. This
workload tests six required detail hydrations, four ordered results including
an unknown date, and actual rendered/stored bytes. A new name alone does not
authorize another attempt at the old work.

## Exact source and calls

Profile `native-g03-date-png-model-v1` uses GPT-6.1 Sol `xhigh`, one model job,
and only MCP server `bgk_g03_native_discovery`. Its exact calls are
`bangumi.query_subjects` then `bangumi.render_query_subjects`, once each with:

```json
{
  "media": "anime",
  "from": "2024-01-01",
  "to": "2024-05-01",
  "rating": { "min": 8 },
  "ratingCount": { "min": 5001 },
  "sort": "date",
  "order": "asc"
}
```

The existing verification kernel admits one local search response and six
unique local detail responses per call, fourteen local responses total and
zero live Bangumi HTTP requests. It uses the actual compiled provider,
Registry, descriptors, normal MCP presenter, Chromium and artifact store.
The six cases and four expected rows remain in the [delivered contract](run95-g03-native-discovery-verification-2026-11-12.md).
The model prompt receives only the request and answer schema; it does not
receive the expected IDs, returned dates, PNG dimensions or hash.

## Execution and evidence boundary

Before claiming, the runner checks the current CLI capabilities/login and
child control access without starting a model. Dispatch then requires a clean
exact Candidate, unchanged Base, seven exact successful CI checks, actual
Product reviewer PASS, current compiled-bundle attestation and source seals.
The global create-only claim label must be acquired and its exact owner/key
read back. Ambiguity grants no invocation authority and never frees a latch.

The private gate directory/file require the current owner, restrictive modes
and regular files. A create-only child-start latch is consumed before control
reads or server construction, preventing an automatic restart from resetting
the call allowance. The model process group has a 360-second deadline and
8MiB stdout cap. The child has an independent 420-second deadline and the
delivered kernel retains its 20-second tool-observation deadline. Extra
tools, shell, search, apps, auxiliary agents, Goals, identity fields, account,
OAuth, community, writes, assets and QQ/TIM are disabled or denied.

Normal MCP result digests and the kernel snapshot are observed independently
inside the child. The parent checks exactly two completed model MCP events,
names/order/arguments/server, the normal query structured result and artifact
response, and the finite JSON answer. The answer retains ordered ID/date rows,
inclusive start/exclusive end, estimated/experimental and upstream-dependent
unknown-date scope, plus the actual returned artifact reference. It cannot
claim visual understanding from an artifact reference. The native verifier
checks decoded PNG dimensions/nonblank signal and the real stored-byte hash.

Success also requires observed native-runtime cleanup before the final
successful tool reply. An outer SDK transport forwards the actual catalog and
normal results through the delivered native server, then closes that finite
inner runtime while keeping its own transport available. Immediate CLI exit
and process-group cleanup cannot race PNG disposal. Later calls fail without
reopening native resources. An isolated process test first reproduced the
exit race and passes with this lifecycle. The delivered kernel is unchanged.
Renderer limits are fixed at 8 seconds, 5,000,000 output bytes and one slot.
Artifacts and Chromium temporary profiles are scoped under the verified private execution directory;
the parent removes that owned directory after its bounded process group ends.
Raw model stdout remains in memory, stderr is counted and discarded, and no
raw answer or PNG enters the public report.

The Ed25519-signed sanitized report binds the exact claim/public key,
Candidate/Base/CI/reviewer, profile/arguments/catalog, source programs, native
snapshot and model-event/answer digests. Internal provider HTTP count and an
invoice hard cap remain unobserved; neither is represented by the process
deadline. Permanent terminal acknowledgement or non-dispatching reconciliation
preserves the first result. Failure is terminal and adds no accepted evidence.

## Acceptance planes and integration

Only the two query/render Agent/MCP rows are eligible after all actual model,
signature, source and live GitHub control checks pass. Public65, account12,
QQ/TIM and their old reports stay independent. G03 remains PARTIAL because
synthetic date cases prove neither current public results nor global coverage.

Implement and test the Python consumer and Harness report dispatcher before
dispatch. A report-only Candidate refresh permits only the new canonical
report, generated acceptance matrix, G03 frontier evidence and named result
documentation. It preserves frozen execution programs, then requires fresh
exact CI and the same reviewer before ordinary Harness integration. No old
profile or native-page program is edited to grant this new workload authority.
