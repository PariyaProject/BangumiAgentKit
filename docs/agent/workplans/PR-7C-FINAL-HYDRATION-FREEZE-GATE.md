BangumiAgentKit — PR-7C FINAL HYDRATION FREEZE GATE

Base:

1dc4322b0226b8edc4a99595bcf546c10012918a

All previously corrected PR-7C semantics are accepted.

DO NOT redesign Discovery.

DO NOT start PR-7D.

This gate fixes only per-query hydration accounting,
hydration failure truthfulness,
and unnecessary hydration.

==================================================
1. P0 — MAKE maxHydrations A TRUE PER-QUERY CEILING
==================================================

Current implementation applies:

candidates.slice(0, budget.maxHydrations)

per hydration batch/page.

This does NOT enforce maxHydrations across the whole query.

Introduce explicit per-query counters.

At minimum:

hydrationsAttempted
hydrationsSucceeded
hydrationsFailed

and:

remainingHydrations =
maxHydrations - hydrationsAttempted

Every provider.getSubject() attempt must consume exactly one
hydration budget unit.

Hard invariant:

hydrationsAttempted <= maxHydrations

for the complete lifetime of one DiscoveryEngine.query().

Never exceed it by even one request.

==================================================
2. boundedHydration CONTRACT
==================================================

Refactor boundedHydration so it does NOT independently receive
the full original maxHydrations every time.

Prefer something like:

boundedHydration(
  provider,
  candidates,
  remainingBudget,
  concurrency,
  context
)

returning:

attempted
succeeded
failed
unresolved

or equivalent typed result.

The caller owns global accounting.

==================================================
3. HYDRATION COVERAGE
==================================================

Extend DiscoveryCoverage with safe observability:

hydrationsAttempted
hydrationsSucceeded
hydrationsFailed
hydrationsUnresolved

optional:

hydrationBudgetExceeded

Do not expose internal URLs/tokens.

==================================================
4. BUDGET EXHAUSTION
==================================================

If the query requires canonical hydration
to decide a filter/sort and there is no hydration budget left:

DO NOT classify unhydrated candidates as non-matches.

They are:

UNRESOLVED.

Result must become:

state = partial

coverage.state = partial

budgetExceeded = true

warning:
DISCOVERY_HYDRATION_BUDGET_EXCEEDED

or equivalent typed warning.

==================================================
5. HYDRATION FAILURE SEMANTICS
==================================================

If getSubject() returns:

unavailable
upstream_error
schema_drift
permission/auth failure
or another state that prevents required field evaluation,

do NOT silently treat that candidate as:

filter mismatch.

Track it as unresolved.

If other valid results exist:

return partial.

If no result can be reliably evaluated,
propagate an appropriate capability failure/partial state.

==================================================
6. NOT_FOUND DURING HYDRATION
==================================================

A candidate discovered in search followed by detail NOT_FOUND may
represent deletion/race/source disagreement.

Do not blindly call it a normal filter miss.

Treat it explicitly:

candidate_unresolved / source_changed

with warning/provenance,
unless there is a documented deterministic policy.

==================================================
7. ONLY HYDRATE WHEN DETAIL IS ACTUALLY REQUIRED
==================================================

Current:

hydrationRequired =
postFilters.length > 0 ||
derivedFilters.length > 0

is too broad.

In particular:

order-only local reverse sorting

must NOT trigger getSubject hydration when the candidate already
contains the required sort field.

Create explicit hydration reasons / required fields.

Examples:

order
→ does NOT itself require hydration

rank reverse
→ no hydration if rank exists in candidate

score reverse
→ no hydration if score exists

date local sort
→ no hydration if candidate date exists

A post-filter that explicitly requires canonical detail
may require hydration.

==================================================
8. FIELD SUFFICIENCY
==================================================

Avoid unnecessary detail calls where the provider candidate already
contains sufficient trustworthy fields.

Current SubjectDiscoveryCandidate already carries:

platform
score
rank
ratingCount
collection
tags
metaTags
date

Audit which filters truly require full getSubject.

Do NOT weaken the meta-tag exclusion policy merely for optimization.

If PR-7C intentionally requires canonical detail for exclusion,
keep that rule.

==================================================
9. GLOBAL BUDGET REGRESSION
==================================================

Mandatory fixture:

10 pages
20 candidates/page

post-filter retains only ~2/page

maxHydrations = 30

Expected:

provider.getSubject calls <= 30

never 31+

coverage = partial if unresolved candidates can affect answer

DISCOVERY_HYDRATION_BUDGET_EXCEEDED present.

This test must specifically prove that removed/nonmatching candidates
still consumed global hydration budget.

==================================================
10. HYDRATION FAILURE REGRESSION
==================================================

Fixture:

candidate discovered successfully

required hydration returns upstream unavailable

Expected:

candidate is NOT counted as a proven non-match.

Result:

partial / unresolved semantics

not false complete.

==================================================
11. REVERSE RANK RESOURCE REGRESSION
==================================================

Input:

sort=rank
order=desc

provider candidate already has rank.

Expected:

correct reverse result semantics

getSubject hydration calls = 0

unless another requested filter genuinely needs detail.

==================================================
12. EXISTING GATES MUST REMAIN GREEN
==================================================

Do not regress:

47/47 all-mode complete

output cap partial

estimated Search total

exact Browse total

multi-category

native rank/heat/score order

reverse rank exhaustive behavior

metaTag POST_FILTER

G01-G10

search_subjects compatibility

get_subject compatibility.

==================================================
13. PUBLIC BUDGET AUTHORITY
==================================================

Keep current accepted behavior:

MCP has no raw budget input.

limit <= 100.

Trusted server ceilings stay:

maxPages 10
maxCandidates 500
maxHydrations 120
concurrency 6
maxConceptProbes 8
maxReturnedItems 100.

After this fix those ceilings must be mechanically enforceable,
not just declarative constants.

==================================================
14. CI
==================================================

Run full existing pipeline.

Exact Final SHA must keep:

provider-foundation          SUCCESS
discovery-foundation         SUCCESS
sqlite-default               SUCCESS
postgres-compat              SUCCESS
host-integration             SUCCESS
standalone-release-smoke     SUCCESS

==================================================
15. FINAL REPORT
==================================================

Report:

A. Final SHA

B. Direct Parent =
1dc4322b0226b8edc4a99595bcf546c10012918a

C. diff stat

D. global maxHydrations implementation

E. 200-candidate / maxHydrations=30 proof

F. exact getSubject call count

G. hydration-failure unresolved proof

H. no false filter mismatch proof

I. reverse-rank zero-unnecessary-hydration proof

J. all-mode regression

K. totalKind regression

L. ordering regression

M. G01-G10 regression

N. Discovery test count

O. provider CI
P. discovery CI
Q. sqlite CI
R. postgres CI
S. host CI
T. standalone CI

U. git status clean

Only when all gates pass write:

PR-7C ADVANCED DISCOVERY & QUERY PLANNER FROZEN

Then STOP.

DO NOT START PR-7D.