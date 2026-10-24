<!-- Hallmark · pre-emit critique: P4 H4 E4 S4 R5 V5 -->

# Run #95 OP-008 Compact Typography Subject Card v5

Date: 2026-10-23 (UTC)
Epoch: `run95-op008-render-card-compact-typography-v5-20261023`
Frontier: OP-008, Subject Intelligence Overview presentation.

## Selection and prior-profile boundary

The v5 profile uses a new synthetic subject and immutable Harness profile after
the v4 attempt became terminal without a report. Profiles v1-v4 keep their
original inputs and terminal dispositions. Do not claim or recreate them.

The selected Base is `a76b39685cd52cc33b5c779b0d9123d4d1093945`. The v5
profile has its own ID, Epoch ID, subject ID, argument profile, claim label,
report path, network mode, and selection-evidence path. It uses the accepted
default typography scale of 0.75 and preserves the current theme and design-pack
switch.

## Fixed synthetic request

- Profile: `render-subject-card-compact-typography-agent-mcp-v5`.
- One call: `bangumi.render_subject_card` with
  `{"subjectId":991905,"includeCollection":false}`.
- One allowed fixture request: anonymous `GET
https://api.bgm.tv/v0/subjects/991905`, intercepted locally. The fixture
  rejects any other URL, method, query, body, duplicate, authorization header,
  collection request, or external asset resolution.
- The synthetic title mixes Japanese, Chinese, and English and is intentionally
  long enough to expose wrapping and clipping issues. The summary and four tags
  add mixed-script line lengths and denser metadata. Images are empty; the
  fixture contains no real subject or account data.
- The bounded Codex answer must equal
  `RENDER_SUBJECT_CARD_SYNTHETIC_ARTIFACT_READY`, matching the report validator.
  It may add only the `render_subject_card` Agent/MCP matrix cell after the
  signed report and Harness disposition pass.

## Visual QA

Before any one-shot claim, render the exact v5 fixture locally at the registered
360 CSS-pixel / 2x output across both `bangumi-light` and `bangumi-dark` and all
three design packs: `warm-editorial`, `clean-gallery`, and `graphic-zine`.
Inspect all six PNGs for readable 0.75-scale typography, mixed-script fallback,
balanced title and summary wrapping, unclipped text, clear score/metadata
hierarchy, spacing, contrast, masks, and visual balance. The renderer's native
design shapes, icon family, theme, and configurable font stacks remain in use.
Keep the previews and contact sheet in a temporary local directory; record only
dimensions and SHA-256 values here.

**QA result:** all six individual 720 × 1212–1490 PNGs were opened and reviewed.
At the accepted 0.75 default typography scale, the Chinese title wraps to two
balanced lines in Warm Editorial and Clean Gallery; Graphic Zine uses three
lines and keeps the full mixed-script title inside its yellow title panel. The
English/Japanese companion title and three-line summary remain readable. Score,
rank, date, icon, and metadata retain a clear order. Each pack keeps its own
silhouette and spacing in light and dark mode; masks do not cut text or cross
the rating panel. No clipping or title/metadata collision was observed. The
fixture has no cover artwork, so the cover placeholder remains visible and this
review establishes no live image-delivery result.

The preview-only runner recorded one exact local fixture response per PNG, zero
external asset requests, and no Harness claim. PNG bytes and contact sheet stay
in a temporary local directory. Their dimensions, byte lengths, and SHA-256
values are:

| Variant                | Dimensions |  Bytes | SHA-256                                                            |
| ---------------------- | ---------: | -----: | ------------------------------------------------------------------ |
| Warm Editorial / light | 720 × 1490 | 271280 | `e10979e243121f13abfd687c6db221ba7c7070a24bb484c3ab4208c492c6d553` |
| Clean Gallery / light  | 720 × 1468 | 202947 | `5392f4180ed0eaf5f0b47e2c1922c2595f39155d41e1c03f2b15b8d7795d06de` |
| Graphic Zine / light   | 720 × 1212 | 223840 | `9d13b707c70745b7e289b43cff14978504c192e268399d5f68b7eccdda4cce86` |
| Warm Editorial / dark  | 720 × 1490 | 246928 | `4902d0bf70d875c80334dc77be478e6e948feb4833dcb23f40a8f31c6a2ee029` |
| Clean Gallery / dark   | 720 × 1468 | 229973 | `384945ada58074c500da520f26bcd11c2a5eb35e1a92753f2c09c89021308178` |
| Graphic Zine / dark    | 720 × 1212 | 207779 | `8ad44dfb4f13b009caa01c78b89e78758d0f2e6b72d9055f6020ecf36b609808` |

The three-column comparison sheet is 1080 × 1558 with SHA-256
`bd1317eac2b034f11351a47578b85d7381d06164e5f640514a4763eb929509a4`.

## Hallmark component-scope audit

The six previews show no named Hallmark anti-pattern. Titles and small labels
stack vertically; body and display type use the selected pack's separate font
stacks; one native `RendererIcon` family supplies the icons; and the three
registered masks create distinct pack silhouettes. The nested cover, rating,
and summary surfaces each carry separate information, so their containment has
a semantic purpose. The clean-gallery and graphic-zine title accents in
`packages/renderer/src/components/TitleBlock.tsx` are local title treatments,
not a stripe on the outside edge of a card.

Previews score: Philosophy 4/5, Hierarchy 4/5, Execution 4/5, Specificity 4/5,
Restraint 5/5, Variety 5/5. No score is below the revision threshold.

This is a text and layout review of the coverless v5 fixture. It does not claim
full fidelity to the image-bearing design boards dated 2026-10-20; the omitted
art deliberately leaves the renderer's cover placeholder in view. A separate
current-source comparison against those boards remains necessary before
calling OP-008's generated-reference fidelity complete.

## Claim gates and scope limits

The only v5 claim requires a clean exact Candidate on current master, seven
successful exact-SHA CI checks, passing Harness `candidate:check`, same-identity
GPT-6 Luna Max review PASS, current MCP bundle attestation, and fresh Harness
`UNCLAIMED` status. The runner permits one exact MCP call only after these gates.
Any inconclusive result is terminal with no retry and no matrix credit.

This profile is one synthetic offline Agent/MCP matrix attempt. It does not
establish production-font installation, live images, account/OAuth, community,
writes, QQ, or TIM behavior. OP-008 remains PARTIAL beyond any single matrix row.

## Implementation references

- `scripts/lib/render-subject-card-offline-profile.mjs` binds the fixture,
  request guard, and immutable profile settings.
- `scripts/acceptance/run-render-subject-card-offline-agent-mcp.mjs` binds the
  runner, exact profile arguments, and exact acknowledgement.
- `scripts/acceptance/render-subject-card-compact-typography-v5-visual-qa.mjs`
  renders the six local preview variants without creating a Harness claim.
- `scripts/lib/agent-mcp-profile-ci-evidence.mjs` requires the exact CI run ID
  and seven named successful checks in the eventual report.
