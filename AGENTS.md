# BangumiAgentKit Agent Instructions

## Product North Star

BangumiAgentKit aims to become the most thoughtful, complete,
trustworthy, intelligent, agent-friendly and visually excellent
way to use Bangumi data.

Before substantial product work, read:

- `docs/agent/AUTONOMOUS_PRODUCT_EVOLUTION.md`
- `docs/product/loop-status.md`
- `docs/product/opportunity-log.md`

If an active workplan is referenced by `loop-status.md`, read it too.

## Working Model

Follow the Autonomous Product Evolution Charter.

Work in bounded product cycles:

OBSERVE
→ QUESTION
→ RESEARCH
→ DESIGN
→ IMPLEMENT
→ TEST
→ USER QA
→ AGENT QA
→ VISUAL QA when applicable
→ FREEZE CANDIDATE

Do not optimize for feature count.

Prioritize:
1. correctness
2. user value
3. Agent leverage
4. information richness
5. Renderer quality
6. evidence and explainability
7. maintainability

## Progress Management

`docs/product/loop-status.md` is the canonical progress ledger.

Update it after meaningful milestones and before stopping.

`docs/product/opportunity-log.md` is the product opportunity backlog.

New ideas should normally be recorded there instead of being
implemented immediately.

## Frozen Foundations

Do not casually redesign frozen foundations or public contracts.

If a frozen foundation blocks a valuable feature, write a
FOUNDATION CHANGE PROPOSAL and stop that architectural change
for human review.

## Human Checkpoint Required

Stop and request review before:

- breaking a frozen public contract
- changing Auth / Principal / confirmation trust semantics
- weakening security or SSRF protections
- enabling Structured Web or HTML globally
- requiring Bangumi web cookies
- large-scale crawling
- major DB semantic migrations
- new destructive/write capabilities
- licensing changes
- publishing packages
- creating releases or tags

## Quality Gate

A capability is not complete because the API call works.

It should answer a meaningful user question with:
- correct semantics
- truthful coverage
- evidence
- graceful failure
- useful Agent UX
- useful human UX
- high-quality visual output where applicable

Never fabricate certainty.

## Git / CI

Do not rewrite frozen history.
Do not force-push shared history.
Do not create release tags automatically.

Final freeze candidates require:
- relevant local test suites
- exact SHA
- remote CI green
- clean git status

When a cycle reaches READY FOR REVIEW, stop modifying that
architectural area.