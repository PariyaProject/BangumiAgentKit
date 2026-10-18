# Run #95 P06 person profile offline renderer visual QA — v2

Date: 2026-10-18

Scope: the `bangumi.render_person_profile` presentation only. This review used entirely synthetic local fixture data and does not provide P06 scenario credit.

## Method

The registered v2 fixture was passed through the local `HttpClient`, `PersonService`, view-model builder, and renderer with a synthetic person (990602), one synthetic subject (990604), and one synthetic character (990605). The five PNGs were opened and inspected individually at CSS viewport widths 320, 360, 520, 640, and 960 pixels. The local fixture completed exactly three expected reads, observed no authorization header, and produced no image URL; the renderer made zero asset requests. No Bangumi account, OAuth token, live API response, or remote image was used. The person fixture's Chinese display name comes from the `简体中文名` infobox entry consumed by `PersonService.mapPerson`.

The same view-model was rendered at 320, 360, 520, 640, and 960 pixel widths. Existing regression checks also measure the document scroll width at 320, 360, and 520 pixels.

## Findings and changes

The first 320-pixel render showed the distribution lists extending beyond the card because their 260-pixel minimum width exceeded the available content width. The mobile layout now lets those lists shrink to the card width. Regression assertions check that the document scroll width stays at 320 pixels at 320/360/520 pixel viewports.

The profile card exposed raw English role/media labels and internal keys (`voice actor`, `anime`, `main`, `Person ID`, and `v0`), showed `(null)` for the missing blood type, and repeated untranslated field names in a warning. The card now localizes known labels, displays the official type code with a Chinese label, suppresses null blood type, and removes the redundant raw-key warning. Long mixed Chinese/Japanese text wraps without visible horizontal spill at the reviewed widths.

The no-image state remains explicit. The card is tall at narrow widths because the fixture includes a long mixed Chinese/Japanese summary, a subject, a character, and source limitations. At 320 and 360 pixels the Chinese display name wraps cleanly and the Japanese original remains visible as secondary text. All sections remain readable, and none of the five images showed a clipped right edge after the fix.

## Render samples

The PNGs were generated in `/tmp` and are deliberately not committed. Their dimensions and SHA-256 values make the exact reviewed samples identifiable in this local run:

| CSS width | PNG dimensions | SHA-256                                                            |
| --------: | -------------: | ------------------------------------------------------------------ |
|       320 |     320 × 1968 | `41a2e36db98e880b99507eb95788b9e7387c02814d9c15c9d96baceb4093874b` |
|       360 |     360 × 1865 | `99b4bc012941c35d41e27aba52882f5e254f745d5b36d170a4844fdcbc3d6d09` |
|       520 |     520 × 1550 | `4c8b6ec523d00483365589f9a5ad88e16c3ae5d5611d1759903c039a007bced2` |
|       640 |     640 × 1198 | `d8ee18d29ef4501b6149f6d1a9b5f8f85e43764d503fd46aafb225a215ccc062` |
|       960 |      960 × 957 | `070291163b917b432a8729d391cdbfd31d252db94d925d5bb8beb88df29bebb2` |

## Limits

This is synthetic offline renderer QA. It does not test OAuth, a signed-in account, a QQ/TIM client, remote asset delivery, real-person profile completeness, latest-20 ordering, ongoing-work classification, or the P06 user scenario. The P06 frontier must remain `UNASSESSED`; only a separately accepted P06 v2 Agent/MCP matrix report can add the `render_person_profile` matrix row.
