# Renderer design baselines

A new Goal wake is not a request to redesign a finished card. Read
`renderer-baselines.json` and run `pnpm harness renderer:baseline-check` before
changing a recorded composition. `continuation:show` includes the same lock
advice; Candidate and legacy-path guards enforce the recorded bytes and source
commit. A registry present in the target base cannot be removed.

Each entry is scoped to one **design pack × template**. The source commit is a
real recovery point. Source files, generated reference, native previews and the
QA receipt have SHA-256 identities. Shared renderer changes still require the
normal integration/visual checks; a lock is not proof that every indirect
dependency or every template has been reviewed.

The six quality scores are Philosophy, Hierarchy, Execution, Specificity,
Restraint and Variety, in that order. They record the designer's scoped release
judgment, not an independent Product verdict or user aesthetic acceptance.
`unobserved` stays unobserved when the user delegates release judgment.

An accepted entry routes to `PRESERVE_BASELINE_CONTINUE_OTHER_WORK`. Preserve its
source and evidence. Add a genuinely different pack independently. To revise an
existing entry, append a successor naming `supersedes`, a new explicit user
request or reproducible regression, its evidence reference, and a concrete
reason. Never overwrite history or reopen merely because the parent Goal is
unfinished, the model changed, or a style could be different.

For this increment, the native cover-led layout covers
`anime-magazine/subject-cohort-comparison`. The original three packs and default
remain available. A new palette selection on other templates does not imply
that their native layouts have been redesigned. The local Pariya text-card
fallback also has its own documented scope.

## Reproduce the scoped QA

From a built checkout with bundled Chromium installed:

```sh
pnpm build
pnpm exec ts-node -P tsconfig.base.json scripts/acceptance/render-anime-magazine-native-qa.ts --matrix --suffix=my-check
pnpm exec ts-node -P tsconfig.base.json scripts/acceptance/render-anime-magazine-native-qa.ts --matrix --suffix=my-dom --export-fixtures
node scripts/acceptance/audit-anime-magazine-native.mjs .artifacts/render/anime-magazine-matrix-my-dom/fixtures.json /absolute/path/new-audit.json
```

Outputs are create-only. Use a fresh suffix/path. The fixture adapter permits
exactly four anonymous synthetic source responses and two local synthetic
cover URLs. It never contacts Bangumi, authenticates, sends a client message,
or consumes a one-shot profile. Demo illustrations must not substitute for
real works' metadata. Production covers use the existing bounded asset resolver.

Keep the receipt and selected previews for recovery. Clean disposable local
iterations after final evidence is preserved; never delete tracked baselines
or user-owned resources.
