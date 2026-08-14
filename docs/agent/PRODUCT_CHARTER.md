# BangumiAgentKit Product Charter

This document owns product direction. It intentionally does not define runtime
states, review ledgers, Candidate persistence, reviewer polling, branch
lifecycle, or merge mechanics. Those belong only to
[`HARNESS.md`](HARNESS.md).

## North Star

Build BangumiAgentKit into the most thoughtful, complete, trustworthy,
intelligent, Agent-friendly, and visually excellent way to use Bangumi data:
the **Bangumi Product Intelligence Layer**.

A serious Bangumi user should be able to ask almost anything they reasonably
want to know and receive one of four honest outcomes:

1. a correct answer;
2. a transparent deterministic derivation;
3. safe retrieval of the required product data; or
4. a precise explanation of why the result is unavailable or not computable.

The product should capture the useful information richness of bgm.tv and,
where reliable data permits, exceed it through aggregation, comparison,
relationships, history, personalization, analysis, and better presentation.

BangumiAgentKit is not merely an API wrapper, scraper, bot, renderer, CLI, or
MCP server. Design from **user questions**, then expose trustworthy semantic
capabilities to Agents, humans, bots, and renderers.

## User-question orientation

Continuously ask:

- What would a serious Bangumi user wish this tool could do?
- What structured capability lets an Agent answer that question without
  guessing or orchestrating dozens of fragile low-level calls?

Representative journeys include:

- discovery: seasonal recommendations, hidden gems, comparisons, popularity,
  and explainable filters;
- subject understanding: identity, ratings, cast, staff, relations, watch
  order, community context, and controversy;
- people and creators: recent work, workload, role mix, collaboration, and
  activity over time;
- personal intelligence: collection state, schedule, backlog, taste, progress,
  and privacy-aware recommendations;
- community and history: current discussion, velocity, score movement, episode
  effects, and historical comparison;
- relationships: franchises, adaptations, cast/staff overlap, and watch order.

## Agent perspective

Every capability should be easy for an Agent to discover and use correctly.
Names and descriptions must reveal when to use it. Inputs should express user
intent without guessing. Outputs must preserve structured context, evidence,
coverage, limitations, and retrieval time where relevant.

Distinguish at least:

- `unknown`
- `unsupported`
- `partial`
- `stale`
- `conflict`
- `not_computable`
- `not_found`

Prefer a small number of meaningful semantic calls over 10–30 low-level calls.
Advanced answers should be able to explain sources, filters, sort meaning,
time windows, coverage, formulas, and limitations even when the normal user
presentation is concise.

## Information richness and composition

Important entities should approach the useful information richness of their
bgm.tv counterparts. A Subject may involve identity, titles, cover, summary,
broadcast/platform/episode information, rating and collection statistics,
tags, characters, voice actors, staff, production roles, relations, user
collection state, reviews, discussion, activity, and derived analytics.

Do not force every dimension into one payload. Prefer composable semantic views
and coordinated output sections.

Capability maturity is progressive:

- L0: raw source reachable;
- L1: typed data;
- L2: semantic capability;
- L3: cross-source aggregation;
- L4: derived intelligence;
- L5: high-quality presentation;
- L6: personalized or historical intelligence.

An endpoint at L1 is not automatically a finished product.

## Sources and evidence

Use capability-specific trustworthy sources in this order when applicable:

1. Official v0;
2. Official Legacy;
3. gated Structured Web;
4. isolated HTML;
5. snapshots;
6. derived analytics.

Do not turn the project into an indiscriminate scraper. Prefer official APIs,
conservative read rates, appropriate caching, narrow feature-specific research,
and minimal retention of user-generated content. Do not copy user web cookies,
bulk mirror content, or inject raw untrusted community text into Agent system
context.

Every claim should expose truthful evidence and coverage. Prefer “partial
coverage over 100 candidates” to “all results” when completeness is unknown.
Prefer `NOT_COMPUTABLE` to fabricated history. Never call a current count a
trend or silently convert unavailable values to zero.

Derived metrics must document:

- formula or methodology and version;
- population and deduplication;
- source fields and evidence;
- time window and retrieval time;
- limitations, bias, and what the metric does not mean;
- confidence where appropriate.

Historical claims require historical observations, not a single current
snapshot.

## Derived intelligence

Where reliable source data allows deterministic analysis, explore value beyond
the website: workload, collaboration networks, seasonal comparisons, rating
variance and polarization, collection conversion, personal backlog and taste,
relationship graphs, watch order, historical movement, community velocity, and
cross-period comparison.

Do not introduce opaque recommendation scores or infrastructure such as a graph
database merely because it is technically interesting. Product value and
explainability must justify the complexity.

## Renderer North Star

Renderer quality is a first-class product surface. The goal is not merely to
produce a PNG; it is to create a carefully designed Bangumi intelligence card
or report that retains useful bgm.tv-level density while improving hierarchy,
grouping, mobile/chat readability, and mixed Chinese/Japanese typography.

Do not copy website pixels. Render semantic ViewModels:

```text
Source data -> Product capability -> Insight/ViewModel -> Renderer
```

Templates must not perform business analysis. Choose text, table, single card,
multi-card report, or chart according to the information rather than forcing
every answer into an image.

Representative visual QA covers covers/avatars, aspect ratios, font fallback,
Chinese/Japanese glyphs, long and short titles, dense tables, high-cardinality
content, mobile-scale readability, clipping, wrapping, hierarchy, missing
images, sparse data, partial/conflict/unavailable states, and zero-network
assumptions. Deterministic fixtures should include old/new subjects, long
titles, varied scripts, many/no tags, missing images, large cast/staff, varied
scores/rank states, and rich/sparse records. Avoid committing copyrighted image
snapshots unnecessarily.

## Product opportunity discovery

Product discovery is continuous but bounded by the selected Goal profile.
Inspect the current corresponding bgm.tv experience narrowly around the
question being solved. Ask what the site, official APIs, legacy APIs, approved
structured sources, and deterministic derivation can each contribute.

Record durable product opportunities in
[`docs/product/opportunity-log.md`](../product/opportunity-log.md), including
user problem, example question, value, available data, source classes, derived
logic, Renderer/Agent opportunity, complexity, risk, priority, provenance, and
status. The log is a hypothesis backlog, not authority to implement everything.

Prioritize high user value, Agent leverage, information gain, reliable data,
and maintainable scope over novelty or feature count. Ten mature semantic
capabilities are better than one hundred shallow wrappers.

Periodically audit complete user journeys and ask what would feel magical, then
classify ideas by present feasibility, snapshot/source needs, risk, and value.

## Capability maturity and quality

A capability is mature only when it:

- answers meaningful user questions with correct semantics;
- provides enough information without uncontrolled volume;
- states coverage, evidence, and uncertainty truthfully;
- handles missing, stale, partial, conflict, unavailable, and not-computable
  states gracefully;
- is discoverable and efficient for an Agent;
- is useful for a human in Standalone/chat output;
- has excellent visual output when rendering applies;
- respects resource, source, privacy, and security bounds;
- keeps runnable documentation and examples current.

Summarize large results, expose counts/filters/pagination, and make details
available through deliberate continuation rather than dumping hundreds of
items.

## Frozen foundations and protected boundaries

Do not casually reopen frozen foundations. If a frozen contract blocks a
high-value capability, prepare a Foundation Change Proposal containing the
blocked capability, why the contract is insufficient, the smallest change,
compatibility impact, migration risk, and alternatives. Then follow the Human
boundary in `HARNESS.md`.

Autonomous work may add read-only semantic capabilities, deterministic
analytics, approved provider usage, tests, product documentation, Renderer and
Standalone improvements, and local refactors that preserve frozen public
contracts.

Human authorization is required before changes to authentication trust,
principal/authorization semantics, write confirmation, tokens/cookies or
credentials, SSRF protections, broad Structured Web/HTML enablement, aggressive
crawling, destructive/write authority, breaking public contracts, irreversible
semantic migrations, paid external services, licensing/legal policy, packages,
releases, or tags.

Writes remain conservative: trusted identity, server-side confirmation, exact
payload binding, auditability, and no model-manufactured authorization.

Trust is more important than appearing knowledgeable. Never hide uncertainty
for UX.
