> [!IMPORTANT]
> Goal, budget, review, and continuation governance is defined by
> `docs/agent/BUDGET_FIRST_EXECUTION.md` and
> `docs/agent/AUTONOMOUS_REVIEW_POLICY.md`.
>
> The Harness supports two explicit modes. Execute-only Goals run one already
> selected milestone and stop. A selected `AUTONOMOUS_EVOLUTION_TIER2` Goal may
> continuously discover and select substantial milestones during the active
> outer session. It never gains automatic review retries beyond the
> per-milestone tier or authority over protected human-only changes.
>
> Each Product Cycle remains one substantial vertical milestone and may contain
> many commits and several hours of Luna Max work. Review Tier and total Sol
> budget are selected per milestone before implementation. Sol is spent only
> after the entire milestone reaches readiness. Execute-only mode requires
> fresh authorization for another Cycle; the self-evolution invocation is
> explicit authority to select later safe milestones until an outer stop
> condition is reached.
>
> Protected architectural/security/legal decisions remain Human-On-Exception
> and must be parked rather than autonomously approved.

BangumiAgentKit
AUTONOMOUS PRODUCT EVOLUTION CHARTER
LOOP MODE / LONG-RUN DEVELOPMENT MODE

==================================================
0. NORTH STAR
==================================================

Your mission is NOT merely:

"add more Bangumi API tools."

Your mission is:

Build BangumiAgentKit into the most thoughtful,
complete,
trustworthy,
intelligent,
agent-friendly
and visually excellent way to use Bangumi data.

The long-term product goal is:

A user should be able to ask almost anything
that a serious Bangumi user could reasonably want to know,

and BangumiAgentKit should either:

A.
answer it correctly,

B.
derive it transparently,

C.
retrieve the necessary Bangumi product data safely,

or

D.
state precisely why it cannot currently be computed.

The ideal experience should capture
the information richness of bgm.tv itself,

and where useful,
go beyond the website through:

- aggregation
- comparison
- relationship analysis
- statistics
- historical analysis
- personalized analysis
- Agent reasoning support
- better presentation.

==================================================
1. PRODUCT IDENTITY
==================================================

BangumiAgentKit is NOT just:

an API wrapper

a scraper

a QQ bot

a renderer

a CLI

or an MCP server.

It should become:

            Bangumi Product Intelligence Layer

                         ↓

       unified trustworthy Bangumi capabilities

                         ↓

           Agent / Human / Bot / Renderer

Think in terms of:

USER QUESTIONS

not:

API ENDPOINTS.

==================================================
2. PRIMARY DESIGN QUESTION
==================================================

Continuously ask:

"If I were a serious Bangumi user,
what would I wish this tool could do for me?"

And separately:

"If I were an LLM Agent,
what structured capability would let me answer
this user question reliably
without guessing?"

These two questions must guide development.

==================================================
3. USER PERSPECTIVE
==================================================

Repeatedly simulate real user intents.

Examples:

DISCOVERY

What should I watch this season?

Which July anime are harem shows?

What were the hottest isekai anime in 2024?

Which highly-rated anime are relatively unknown?

Which shows suddenly became popular?

Which original anime from the last 5 years are best rated?

--------------------------------------------------

SUBJECT UNDERSTANDING

Tell me everything important about this anime.

Who are the main characters?

Who voices them?

Who made it?

What related works exist?

How should I watch the series?

How controversial is its rating?

What do users seem to like/dislike?

--------------------------------------------------

PERSON / SEIYUU

What has this voice actor worked on recently?

Are they unusually busy this year?

How many TV anime roles have they had?

Main roles vs supporting roles?

Who do they collaborate with most?

Which directors/studios do they repeatedly work with?

--------------------------------------------------

PERSONAL

What am I currently watching?

What updates this week?

What have I abandoned?

What completed anime have I still not finished?

What genres do I rate unusually highly?

How has my taste changed?

What should I continue next?

--------------------------------------------------

COMMUNITY

What is Bangumi talking about today?

Which anime are gaining discussion fastest?

Which titles are highly controversial?

Which episodes caused discussion spikes?

What are people saying about this show?

--------------------------------------------------

HISTORY / ANALYTICS

How did this anime's rating evolve?

When did it become popular?

Did the final episode change its score?

Which seasonal rankings changed the most?

Which voice actors became much more active this year?

--------------------------------------------------

RELATIONSHIPS

What is the correct watch order?

What is sequel / prequel / spin-off?

What staff repeatedly work together?

What shows share large portions of staff?

What voice actors often appear together?

==================================================
4. AGENT PERSPECTIVE
==================================================

Every capability should also be evaluated from the Agent's perspective.

Ask:

Can an LLM discover this tool easily?

Is the tool name semantically obvious?

Does its description explain when to use it?

Can the Agent express the user's intent without guessing?

Does the output contain enough structured context?

Does it preserve evidence?

Does it distinguish:

unknown
unsupported
partial
stale
conflict
not_computable
not_found?

Can the Agent explain why an answer was produced?

Can it avoid needing dozens of low-level calls?

Could one higher-level semantic capability replace
20 fragile raw API calls?

==================================================
5. INFORMATION RICHNESS GOAL
==================================================

For important Bangumi entities,
aim to eventually expose approximately
the information richness of the original website.

For a Subject,
consider:

identity
titles
cover
summary
broadcast date
platform
episodes

rating
ranking
rating histogram
collection distribution

tags
meta tags

characters
CVs

staff
production roles

relations
franchise links

episode information

user collection state

reviews
comments
discussion

statistics

community activity

derived analytics.

Do NOT force everything into one payload.

Design composable capability views.

==================================================
6. "MORE THAN BANGUMI" GOAL
==================================================

Where raw Bangumi data allows deterministic analysis,
BangumiAgentKit should eventually provide more insight
than simply opening the website.

Examples:

voice actor workload

staff collaboration network

season comparison

rating variance

rating polarization

collection conversion

personal backlog

personal taste distribution

relationship graph

watch order

historical movement

community velocity

cross-period comparison.

Every derived metric must include:

formula / methodology
source evidence
time window
limitations
confidence where appropriate.

==================================================
7. RENDERER NORTH STAR
==================================================

Renderer quality is a FIRST-CLASS product goal.

The goal is NOT:

"make a PNG."

The goal is:

Produce output that feels like a carefully designed
Bangumi intelligence card/report.

The ideal output should:

retain the information density of bgm.tv

while being easier to understand
in QQ / Discord / mobile / chat contexts.

==================================================
8. RENDERER SHOULD EVENTUALLY SUPPORT
==================================================

At minimum explore:

SubjectOverview

SubjectDeepDive

SearchResults

DiscoveryRanking

SeasonOverview

SubjectStats

RatingDistribution

Cast

Staff

Relations

WatchOrder

PersonProfile

VoiceActorWorkload

StaffActivity

CollaborationGraph

CollectionDashboard

PersonalWeeklySchedule

CommunityTrending

DiscussionSummary

HistoricalTrend

ComparisonCard.

Do NOT implement all at once.

Use user value to prioritize.

==================================================
9. RENDERER IS NOT A WEBSITE SCREENSHOT
==================================================

Do not blindly recreate bgm.tv pixels.

"复刻 Bangumi 信息量" means:

capture equivalent useful information,

not:

copy exact website visual design.

Renderer should improve:

hierarchy
density
readability
grouping
mobile legibility
Chinese/Japanese mixed typography
long titles
many characters
large cast
large staff tables.

==================================================
10. VISUAL QUALITY LOOP
==================================================

Renderer work must include REAL visual QA.

Do not treat:

PNG exists

as success.

For every major renderer:

generate representative outputs.

Inspect:

cover correctness

avatar correctness

aspect ratios

font fallback

Chinese glyphs

Japanese glyphs

long titles

very short titles

dense staff tables

empty states

partial data

missing images

NSFW-safe presentation if relevant

mobile-scale readability

text clipping

line wrapping

alignment

visual hierarchy.

==================================================
11. VISUAL GOLDEN SET
==================================================

Maintain a representative rendering corpus.

Include:

new anime

old anime

very long title

Chinese title

Japanese title

no Chinese title

many tags

no image

many characters

huge staff list

low score

high score

unranked

large community activity

sparse subject

rich subject.

Do not commit copyrighted image snapshots unnecessarily.

Prefer deterministic fixtures plus local/manual visual review.

==================================================
12. SOURCE PRIORITY
==================================================

Preserve frozen source philosophy.

Prefer capability-specific trustworthy sources.

Current source model:

Official v0

Official Legacy

gated Structured Web

isolated HTML

Snapshots

Derived Analytics.

Do NOT turn this project into an indiscriminate scraper.

==================================================
13. WEBSITE EXPLORATION REMAINS CONTINUOUS
==================================================

Although broad PR-7A research is frozen,
product discovery does NOT stop.

Whenever implementing a capability:

inspect the CURRENT corresponding bgm.tv experience.

Ask:

What information does the website expose?

What user actions exist?

What does API expose?

What does legacy expose?

Does structured web expose something richer?

Is HTML actually necessary?

Could the Agent derive something useful?

Research narrowly around the feature being developed.

==================================================
14. AUTONOMOUS VALUE DISCOVERY
==================================================

You are explicitly encouraged to discover
new useful product ideas.

Do not wait for the human to enumerate every feature.

During each development cycle,
record observations like:

"Users may benefit from..."

"This relationship enables..."

"Bangumi exposes data that could support..."

"Current output hides an important dimension..."

"An Agent currently needs N calls for this;
a semantic capability could reduce this to one..."

==================================================
15. PRODUCT OPPORTUNITY LOG
==================================================

Maintain:

docs/product/opportunity-log.md

Each discovered opportunity records:

Title

User problem

Example question

Why useful

Available data

Required source classes

Derived logic

Renderer opportunity

Agent tool opportunity

Complexity

Risk

Suggested priority

Status.

Do not immediately implement everything in this file.

==================================================
16. OPPORTUNITY SCORING
==================================================

Score ideas using:

User Value         1-5

Agent Leverage     1-5

Information Gain   1-5

Data Availability  1-5

Reliability        1-5

Implementation Cost 1-5

Maintenance Risk   1-5

Source Risk        1-5.

Prioritize features with:

high user value
high agent leverage
high reliable data availability

before:

novel but fragile features.

==================================================
17. DO NOT OPTIMIZE FOR FEATURE COUNT
==================================================

10 excellent semantic capabilities
are better than
100 shallow wrappers.

A feature is valuable when it allows
a real user question to be answered well.

==================================================
18. CAPABILITY MATURITY
==================================================

Think of capabilities in levels.

L0
raw source reachable

L1
typed data

L2
semantic capability

L3
cross-source aggregation

L4
derived intelligence

L5
high-quality presentation

L6
personalized / historical intelligence.

Do not pretend L1 is a finished product
just because an endpoint exists.

==================================================
19. DEVELOPMENT LOOP
==================================================

Within each bounded milestone authorized directly or selected by the active
self-evolution profile, use:

OBSERVE

→ QUESTION

→ RESEARCH

→ DESIGN

→ IMPLEMENT

→ TEST

→ USE IT AS A USER

→ USE IT AS AN AGENT

→ VISUALLY INSPECT

→ REVIEW EVIDENCE

→ IDENTIFY NEXT GAP

→ RECORD THE NEXT GAP

→ STOP AT THE GOAL CONDITION.

==================================================
20. OBSERVE
==================================================

At the beginning of each cycle:

inspect current product behavior.

Use:

Standalone

semantic tools

MCP

render outputs

bgm.tv

official APIs

existing research.

Do not choose the next task solely
because it is next in an old roadmap.

==================================================
21. QUESTION
==================================================

Ask:

What user question currently feels bad?

What currently requires too many tool calls?

What output feels incomplete?

What information exists but is not surfaced?

What claim cannot currently be proven?

What useful Bangumi relationship is unused?

What visual output feels obviously inferior
to seeing the original site?

==================================================
22. RESEARCH
==================================================

Do narrow targeted research.

Use:

official OpenAPI

official source code

live read-only probes

website behavior

frontend private schema if appropriate

existing research.

Do not perform a new broad crawl
unless truly necessary.

==================================================
23. DESIGN
==================================================

Before writing substantial code,
state:

USER PROBLEM

TARGET QUESTIONS

DATA SOURCES

SOURCE AUTHORITY

CAPABILITY CONTRACT

DERIVED FORMULAS

EVIDENCE

COVERAGE

FAILURE STATES

AGENT UX

HUMAN UX

RENDERER UX

TEST PLAN.

==================================================
24. IMPLEMENT
==================================================

Prefer vertical slices.

Example:

Question:

"XX声优过去一年忙不忙？"

Implement end-to-end:

source relationship
→ normalization
→ analytics
→ semantic tool
→ standalone
→ evidence
→ renderer data model
→ tests.

Do not implement disconnected plumbing
for months without user-visible capability.

==================================================
25. TEST
==================================================

Every important capability should have:

unit tests

contract tests

integration tests

negative tests

resource-bound tests

golden user scenarios

cross-surface tests

where applicable.

Live network must not be mandatory CI.

==================================================
26. USE IT AS A REAL USER
==================================================

After implementation,
actually ask realistic questions.

Do not only call synthetic fixtures.

Examples:

"2024年最热门的异世界TV动画前10"

"水濑祈过去半年工作量"

"少女终末旅行角色和声优"

"今天我在看的番更新什么？"

Evaluate whether the answer
would satisfy a real Bangumi user.

==================================================
27. USE IT AS AN AGENT
==================================================

Evaluate whether an external Agent can:

choose the correct tool

understand input schema

avoid guessing

recover from ambiguity

understand partial results

cite evidence

produce a natural explanation.

If the Agent needs unreasonable orchestration,
consider a higher-level semantic tool.

==================================================
28. SELF-CRITIQUE
==================================================

At the end of every cycle ask:

What is still obviously weak?

What would embarrass us
if a Bangumi power-user tried this?

What information is missing?

What is technically correct
but product-wise unsatisfying?

What can the website do
that AgentKit still cannot?

What can AgentKit potentially do
that the website cannot?

==================================================
29. FROZEN FOUNDATION RULE
==================================================

Do NOT casually reopen frozen foundations.

If a frozen contract blocks a high-value capability:

do NOT silently redesign it.

Produce a short:

FOUNDATION CHANGE PROPOSAL

containing:

blocked capability

why current contract is insufficient

minimal change

compatibility impact

migration risk

alternatives.

Then PARK that architectural direction
for human review.

Execute-only mode stops. Self-evolution mode may return to discovery and choose
another independent safe direction; it must never implement around the parked
boundary.

==================================================
30. AUTONOMOUS IMPLEMENTATION AUTHORITY
==================================================

You MAY autonomously:

add new read-only semantic capabilities

add analytics

add deterministic query logic

improve renderer templates

improve Standalone UX

add tests

add docs

add research probes

add provider adapters
only when already approved by source policy

refactor local implementation
without changing frozen public contracts.

==================================================
31. REQUIRE HUMAN REVIEW BEFORE
==================================================

Do NOT autonomously:

change authentication trust model

change principal semantics

weaken write confirmation

expose tokens

weaken SSRF protections

enable web cookies

enable S3/HTML broadly without planned gate

perform aggressive crawling

change project license

publish packages

create GitHub releases

create release tags

introduce breaking public tool contracts

remove frozen compatibility

introduce paid external services

introduce new destructive/write capabilities
without explicit safety design.

These require a review checkpoint.

==================================================
32. WRITE CAPABILITY RULE
==================================================

Read intelligence may evolve quickly.

Writes remain conservative.

Every new write:

must use trusted identity

must use server-side confirmation

must have clear payload binding

must be auditable

must never allow the model
to manufacture authorization.

==================================================
33. WEB ACCESS ETHICS
==================================================

Respect Bangumi.

Use conservative read rates.

Cache where appropriate.

Do not bulk mirror content.

Do not archive large user-generated pages unnecessarily.

Do not copy user web cookies.

Prefer official APIs.

Use Structured Web only behind explicit policy.

Use HTML only when necessary.

==================================================
34. SNAPSHOT DISCIPLINE
==================================================

Never claim historical trend
from one current snapshot.

Questions like:

"过去7天增长最快"

require historical observations.

If historical data is absent:

NOT_COMPUTABLE

is better than fabricated trend.

==================================================
35. ANALYTICS DISCIPLINE
==================================================

Every derived metric must answer:

What is the formula?

What is the population?

What is deduplicated?

What time window?

What source fields?

What known bias?

What does it NOT mean?

==================================================
36. PERSON ANALYTICS EXAMPLE
==================================================

VoiceActorWorkload should eventually distinguish:

unique anime

unique TV anime

character roles

main roles

supporting roles

3-month

6-month

12-month

previous-period comparison.

Do not count:

music
games
duplicate character relations

unless requested.

==================================================
37. COMMUNITY DISCIPLINE
==================================================

Distinguish:

current count

current ordering

current activity

discussion volume

discussion velocity

historical growth.

Do not call one:

"trend"

when only another is known.

==================================================
38. RENDERER DATA MODEL
==================================================

Renderer must consume semantic ViewModels.

Preferred:

Source Data
→ Product Capability
→ Insight/ViewModel
→ Renderer

Do not make React templates perform business analysis.

==================================================
39. RENDERER COMPOSITION
==================================================

Eventually allow one answer to produce
multiple coordinated visual sections.

Example:

"介绍一下少女终末旅行"

could produce:

SubjectOverview

+
RatingStats

+
MainCast

+
Staff

+
Relations

instead of one overloaded card.

==================================================
40. RENDERER DENSITY
==================================================

Aim for:

high information density
without visual overload.

Use:

sections

tables

chips

small multiples

charts

relationship summaries

compact metadata.

Do not create giant walls of text in PNG.

==================================================
41. RENDERER FALLBACK
==================================================

Every visual capability needs graceful behavior for:

missing image

missing score

partial source

unavailable source

unknown field

conflict

auth required

not computable.

Never show fake zero values.

==================================================
42. RENDERER QUALITY SCORECARD
==================================================

For every significant renderer,
evaluate:

Correctness

Information completeness

Visual hierarchy

Readability

Mobile suitability

Density

Typography

Image quality

Missing-data behavior

Partial-state behavior

Japanese/Chinese support.

Record weak areas.

==================================================
43. BANGUMI WEBSITE PARITY AUDIT
==================================================

Periodically choose one major bgm.tv page
and compare AgentKit capability.

Examples:

subject

person

calendar

stats

characters

relations

user collection

Rakuen.

Ask:

What does this page tell the user?

Can AgentKit answer the same questions?

What are we missing?

What could we improve beyond it?

==================================================
44. AGENT EFFICIENCY SCORE
==================================================

Periodically measure:

How many semantic tool calls
does an Agent need for common questions?

Target:

one high-level question
should usually require
a small number of meaningful calls.

If an Agent routinely requires
10–30 low-level calls,
consider a semantic aggregation capability.

==================================================
45. EXPLAINABILITY
==================================================

Advanced answers should be able to explain:

source

filters

sort meaning

time window

coverage

derived formula

limitations

retrievedAt.

Normal user output can stay concise.

Full explanation should remain available.

==================================================
46. NO FAKE CERTAINTY
==================================================

Prefer:

"We scanned 100 candidates;
coverage is partial."

over:

"These are all results."

Prefer:

"This is Bangumi collection heat."

over:

"This is the hottest show this week."

Prefer:

"Current source does not expose this."

over:

inventing.

Trust is more important than
appearing knowledgeable.

==================================================
47. ROADMAP IS ADAPTIVE
==================================================

Current expected direction is approximately:

PR-7D
Person / Seiyuu / Staff Intelligence

PR-7E
Calendar / Personal Schedule

PR-7F
Snapshots / Historical Intelligence

PR-7G
Structured Web

PR-7H
HTML Provider

PR-7I
Renderer 2.0

PR-7J
Community Intelligence.

BUT THIS IS NOT A COMMANDMENT.

At every freeze boundary,
re-evaluate priority using:

user value

dependency structure

research findings

newly discovered opportunities.

The roadmap and opportunity log are living implementation hypotheses, not the
North Star. In self-evolution mode Luna may add missing work, split oversized
items, merge artificial fragments, reorder priorities, defer low-value work,
and mark obsolete entries `SUPERSEDED`. Persist the previous state, new state,
evidence, and rationale for every material change.

==================================================
48. DO NOT RUN FOREVER WITHOUT CHECKPOINTS
==================================================

Long-run mode may be autonomous inside one Goal,
but must remain budgeted and bounded.

Work in bounded product cycles.

The outer Goal may contain multiple cycles only when the self-evolution profile
is explicitly selected. Each cycle receives a fresh milestone scope, branch,
PR, review ledger, and Freeze/integration checkpoint; review budget never leaks
between cycles.

Each cycle should have:

one primary capability theme

clear acceptance criteria

a finite test matrix

a freeze candidate SHA.

Commit count alone is not a review trigger. A cost-efficient primary thread may
produce many understandable commits inside one coherent milestone, but must not
expand into unrelated capabilities or an unreviewable giant diff.

==================================================
49. AUTONOMOUS CYCLE SIZE
==================================================

Preferred cycle size:

roughly one coherent PR-level capability.

Examples:

VoiceActor Intelligence

Calendar Intelligence

Snapshot Foundation

Renderer Subject 2.0.

Each cycle should be independently reviewable.

==================================================
50. COMMIT DISCIPLINE
==================================================

Use staged commits.

Typical sequence:

research/probe

contracts

implementation

integration

renderer/presentation if in scope

tests

corrective/freeze.

Keep commits understandable.

==================================================
51. GIT SAFETY
==================================================

Never:

force push shared history

rewrite frozen commits

delete unrelated user work

create release tags

publish packages.

Keep working tree clean at freeze candidates.

==================================================
52. CI DISCIPLINE
==================================================

Never declare a cycle complete
because local tests pass.

Final freeze candidate requires:

exact SHA

remote CI

all relevant mandatory jobs green.

New foundation areas should gain
their own mandatory CI coverage.

==================================================
53. FAILURE-DRIVEN EXPLORATION
==================================================

When a manual scenario fails:

do not patch only the exact example.

Ask:

What category of product deficiency caused this?

Example:

"cover is green"

→ not just CSS;
investigate AssetResolver transport.

"search misses OVA"

→ not just add OVA;
investigate planner filter semantics.

Treat failures as architecture/product signals.

==================================================
54. PRODUCT QUALITY BAR
==================================================

A capability is NOT complete merely because:

the API call succeeds.

A capability is mature when:

it answers a meaningful user question

with correct semantics

with enough information

with trustworthy evidence

with graceful failure

with good Agent discoverability

and,
where appropriate,
with high-quality visual output.

==================================================
55. DEFINITION OF EXCELLENT
==================================================

For a major capability,
aim for:

Correctness:
no known semantic lies.

Coverage:
clear completeness semantics.

Information richness:
close to or beyond useful website information.

Agent usability:
obvious tool choice and structured output.

Human usability:
natural explanation and useful Standalone output.

Visual quality:
presentation worth sending directly in chat.

Robustness:
missing/stale/partial/conflict handled.

Evidence:
answer can explain itself.

==================================================
56. PERIODIC "WHAT WOULD BE AMAZING?" REVIEW
==================================================

Every 2–3 product cycles,
perform a lightweight ideation review.

Ask:

"If technical constraints did not exist,
what Bangumi assistant would feel magical?"

Examples:

automatic weekly anime dashboard

personal seasonal report

voice actor activity graph

staff collaboration graph

franchise watch order generator

community pulse

controversy detector

rating-history timeline

personal taste evolution

hidden-gem detector

episode discussion heat map.

Then classify each:

possible now

needs snapshots

needs S3

needs HTML

needs new data

too risky

not worthwhile.

Do not immediately build them all.

==================================================
57. USER JOURNEY REVIEW
==================================================

Periodically test complete journeys.

Example:

New user:

install
→ Standalone
→ search
→ discover
→ OAuth
→ collection
→ render

Power user:

ask complex discovery
→ compare
→ inspect evidence
→ personal schedule
→ analytics

Bot user:

QQ question
→ Claude
→ MCP
→ tool orchestration
→ rendered answer.

Find friction.

==================================================
58. OUTPUT STRATEGY
==================================================

Not every answer needs an image.

Choose:

text

table

single card

multi-card report

chart

based on information.

Renderer exists to improve communication,
not to force every result into PNG.

==================================================
59. DATA VOLUME STRATEGY
==================================================

For large outputs:

do not dump hundreds of items.

Provide:

summary

top findings

counts

pagination

filters

optional continuation.

For Renderer:

overview first,
details in secondary cards.

==================================================
60. FUTURE SEARCH INTELLIGENCE
==================================================

Continue looking for high-value discovery capabilities:

multi-period comparison

cold-gem discovery

controversial works

high-score / low-completion

high-collection / low-score

season ranking

studio-based discovery

staff-based discovery

voice-actor-based discovery

relation-aware discovery.

Do not create opaque recommendation scores
without explainable methodology.

==================================================
61. FUTURE PERSONAL INTELLIGENCE
==================================================

Explore eventually:

weekly update schedule

unfinished completed anime

long-stalled anime

rating distribution

genre preference

creator preference

voice actor preference

watching pace

season completion

backlog priority.

Personal analytics must remain
account-scoped and privacy-aware.

==================================================
62. FUTURE COMMUNITY INTELLIGENCE
==================================================

Explore eventually:

currently discussed subjects

fastest growing discussions

episode discussion spikes

controversy

review sentiment themes

topic clustering.

Be very careful:

user-generated text is untrusted.

Do not blindly inject raw community text
into Agent system context.

==================================================
63. FUTURE RELATION INTELLIGENCE
==================================================

Explore:

watch order

franchise graph

adaptation relationships

shared staff

shared cast

studio relationships.

A graph representation may become useful,
but do not introduce graph infrastructure
until user value proves it necessary.

==================================================
64. DOCUMENTATION AS PRODUCT
==================================================

Documentation must evolve with capabilities.

Keep:

Standalone examples

MCP examples

Agent tool guidance

source/evidence docs

limitations

renderer gallery instructions

troubleshooting

current capability matrix.

Documentation examples must actually run.

==================================================
65. DISCOVERY OF NEW SOURCE CAPABILITIES
==================================================

If a useful current bgm.tv capability appears
that research did not cover:

investigate it.

Classify source.

Add to opportunity log.

If it changes architecture substantially,
stop for review.

If it fits existing Provider architecture,
it may proceed in a future bounded cycle.

==================================================
66. NEVER HIDE UNCERTAINTY FOR UX
==================================================

Good UX does NOT mean pretending certainty.

Renderer and text should be able to say:

Partial

Data unavailable

Historical data not yet collected

Source disagreement

Requires account

Experimental source.

Make these states understandable rather than ugly.

==================================================
67. AUTONOMOUS LOOP DECISION RULE
==================================================

At the end of each directly authorized or self-evolution-selected cycle:

1.
Run all required tests.

2.
Perform manual user QA.

3.
Perform Agent/tool QA.

4.
Perform visual QA if applicable.

5.
Update opportunity log.

6.
List remaining defects.

7.
Classify defects:

BLOCKER
HIGH VALUE NEXT
MAINTENANCE
DEFERRED.

8.
If blockers are known before review:
fix them within the current cycle before spending the review budget.

9.
If no blockers:
produce one clean Freeze Candidate and stop at the review gate.

10.
Do NOT automatically declare foundation frozen
if the change is architecturally significant.

Prepare it for external review. Do not launch reviewers unless the execution
ledger records authorization and remaining budget.

==================================================
68. LOOP CONTINUATION AFTER FREEZE CANDIDATE
==================================================

When a cycle reaches:

READY FOR REVIEW

STOP implementation and run the budget/readiness gate.

Do not keep polishing it indefinitely.

In execute-only mode, do not start research, planning, or implementation for
the next Cycle inside the current Goal. Record follow-up ideas and stop at the
configured milestone outcome.

In self-evolution mode, finish the current milestone's review, Freeze,
integration, and branch-cleanup contract first. Then persist the checkpoint,
update the living backlog with provenance, and return to `OBSERVE` and targeted
opportunity discovery. Do not carry unfinished scope or review budget into the
next milestone.

==================================================
69. SAFE UNATTENDED MODE
==================================================

In unattended operation:

prefer:

read-only capabilities

tests

renderer improvements

research

documentation

local deterministic analytics.

Be conservative with:

auth

writes

new data sources

schema changes

migrations

external network intensity.

Never perform destructive real-account tests.

==================================================
70. HUMAN CHECKPOINT TRIGGERS
==================================================

PARK the affected direction and request review when:

a frozen public contract must change

a DB migration has substantial semantic impact

auth/security model must change

new website credentials/cookies would be needed

S3 becomes default

HTML becomes default

a new write capability is introduced

legal/source terms are unclear

persistent user tracking is proposed

large-scale scraping is proposed

release/tag/publish is proposed.

Execute-only mode stops after parking. Self-evolution mode may continue only
with another independent safe milestone; it stops if the protected issue is a
global emergency or no meaningful safe work remains.

==================================================
71. CURRENT EXECUTION AUTHORITY
==================================================

`docs/product/loop-status.md` is the only current execution ledger.

Do not infer authority from historical sequences in this Charter.

Before implementation, either the user must authorize one substantial vertical
execute-only milestone or explicitly select the self-evolution profile. Every
selected milestone's Cycle Plan must record scope, non-scope, acceptance and
stopping conditions, validation, Review Tier, total Sol launch budget, and any
`TIER_2` reviewer order.

After that milestone stops or freezes, execute-only mode does not select another
Cycle. Self-evolution mode checkpoints or parks the milestone, then returns to
discovery and may select another independent safe substantial milestone.

==================================================
72. FIRST AUTONOMOUS PRODUCT QUESTION
==================================================

After PR-7C,
start by asking:

"What would make BangumiAgentKit
meaningfully better than opening a Bangumi person page?"

Potential answers may include:

voice actor workload

recent activity

main/support role distribution

period comparison

career timeline

highest-rated recent works

most frequent collaborators

recurring staff teams.

Validate before implementation.

==================================================
73. PRODUCT EXPLORATION REPORT FORMAT
==================================================

Before each new major cycle,
produce a concise internal proposal:

CYCLE TITLE

USER VALUE

10 representative questions

current capability

data sources

missing pieces

proposed semantic tools

proposed analytics

proposed renderer

risks

tests

why this should be next.

Then implement if it fits frozen architecture.

==================================================
74. END STATE
==================================================

The desired long-term experience is:

A user can naturally ask BangumiAgentKit
almost any reasonable Bangumi-related question,

and receive an answer that is:

correct

rich

transparent

visually excellent

source-aware

personalized where appropriate

and often more useful
than manually browsing several Bangumi pages.

==================================================
75. FINAL PRINCIPLE
==================================================

Do not ask only:

"Can we implement this?"

Ask:

"Would this make Bangumi meaningfully better to use?"

Do not ask only:

"Does the API return data?"

Ask:

"What can a user understand from this data?"

Do not ask only:

"Does the renderer generate?"

Ask:

"Would I be happy to send this output directly to another person?"

Do not ask only:

"Can the Agent call the tool?"

Ask:

"Can the Agent reliably answer the user's actual question?"

Build toward THAT product.
