# Run #95 UX-002 Compact Typography Renderer Profile v4

Date: 2026-10-23 (UTC)
Epoch: run95-op008-render-card-v4-codex-config-20261022
Frontier: OP-008, subject overview presentation.

## Selection and prior-profile boundary

The v4 profile is a new synthetic input after the v3 runner exposed a Codex CLI
configuration defect before it could produce a report. The old runner supplied
deprecated features.web_search, features.web_search_cached, and
features.web_search_request options even though top-level
web_search="disabled" already disables search. A local no-MCP CLI
reproduction returned three configuration errors with those options and none
after their removal. The redundant options have been removed from the
acceptance runners and guarded by a source regression test.

Profiles v1, v2, and v3 retain their original inputs and terminal Harness
dispositions. Any consumed profile remains no-retry. The v4 profile has its
own profile ID, Epoch ID, argument profile, synthetic subject, network mode,
claim label, report path, and selection evidence. It does not reinterpret or
replace an earlier attempt.

## Fixed synthetic request

- Profile: render-subject-card-compact-typography-agent-mcp-v4.
- One call: bangumi.render_subject_card with
  {"subjectId":991904,"includeCollection":false}.
- One allowed request: GET https://api.bgm.tv/v0/subjects/991904. The local
  MCP server intercepts it and returns the registered synthetic Subject. No
  external API request, collection request, authorization header, or image URL
  is allowed.
- Fixture title: 星降る海辺のアトリエ / Atelier of Falling Stars;
  Chinese title: 星海手记：一段关于旅途、夏夜、旧书店与远方灯火的故事. The
  summary and four tags add mixed-script line lengths and denser metadata to
  the synthetic visual fixture. It contains no real subject or user information.
- Renderer uses its default 0.75 font-size scale. Before the one-shot call,
  render this exact fixture locally and inspect the PNG for clipping, awkward
  wrapping, title/metadata collisions, and visual balance. Keep the image in a
  temporary local QA location only. The report stores artifact dimensions,
  byte length, and SHA-256; it never stores image bytes, prompt, answer, or
  fixture rows.

## Claim gates and outcome limits

The only v4 claim requires the exact current Candidate and Base, seven
successful exact-SHA CI checks, passing Harness candidate:check,
same-identity GPT-6 Luna Max review PASS, current bundle attestation, and fresh
Harness UNCLAIMED status. The runner binds that PASS to the exact Candidate
and Base. It exposes only the registered tool, rejects any extra call or
request, and retains the zero-non-MCP and zero-shell gates. Any v4
inconclusive result is terminal and cannot be retried.

The profile can add only the render_subject_card Agent/MCP matrix row if its
sanitized report and Harness disposition pass. Visual inspection is tracked
separately and does not by itself create matrix credit. This profile does not
test production fonts, external images, account/OAuth, community, writes,
QQ, or TIM.

No v4 profile claim or MCP call has occurred as of this selection record.

## Implementation references

- `packages/renderer/src/templates/SubjectCard.tsx` lowers the graphic-zine
  title scale and allows up to three title lines.
- `packages/renderer/src/components/TitleBlock.tsx` balances graphic-zine title
  wrapping.

## Preview-only visual QA

The exact v4 fixture was rendered through the local ToolRegistry with the
registered offline fetch and asset guards. Six 720-pixel previews covered both
themes and all three design packs. Each preview used one synthetic local
fixture response, with zero external API or image requests. No Harness claim,
Agent/MCP call, report, or image artifact was created by this preview step.

The default warm-editorial / bangumi-light card passed visual inspection: the
Chinese title wraps over two readable lines, the Japanese/English subtitle and
summary remain legible, and the score and metadata retain clear hierarchy.
Clean-gallery also retains a readable two-line title. The first zine preview
truncated the longer Chinese title. Before accepting that design pack, the
renderer now uses a smaller zine title scale, allows three title lines, and
balances those lines. The revised light and dark zine previews show the full
title in three even lines without cover-stage overflow. A focused renderer
regression check and 15 profile/config tests pass.

The six individual preview PNGs and comparison sheet are kept only in a
temporary system directory for local review. The comparison sheet SHA-256 is
3257cdfaee2c3296806f5ea9fb71d1d7450dc81e4920d3def4a47c47acd28c37. Individual
PNG SHA-256 values, in the order warm-editorial/light, clean-gallery/light,
graphic-zine/light, warm-editorial/dark, clean-gallery/dark, and
graphic-zine/dark, are:

- 3a1a9e54212cb25909d8ffb06da5935cd298bdca37710387c8b956a5ea1ac3cd
- d1d85115ac11b05e4a1e5a101626a3cf38d940dbb98ee69bf69bec35da01683a
- 59b3989bd7a206c2ffc5f8367bf431d28b25717e84169c6608c0b471e26d1ec0
- 01fa5cfcdaed5535e6ff3d00b265d728b71826e96569998de39786ab7c59ac9c
- e7af4a20ca4011337e9c7fbd1cccf80c0833ae78cac04d5718b84fddd359311b
- e28eaf6f75131578f9267a1e0baceacadd51fd70b24334f08430744e7f366d64

The fixture intentionally has no cover image. These previews verify text
hierarchy, masks, placeholder treatment, color, and spacing; they do not claim
that a production cover image or QQ/TIM message was visually verified.
