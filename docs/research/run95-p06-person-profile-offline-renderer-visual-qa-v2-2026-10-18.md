# Run #95 P06 person profile offline renderer visual QA — v2

Date: 2026-10-18

Scope: the `bangumi.render_person_profile` presentation only. This review used entirely synthetic local fixture data and does not provide P06 scenario credit.

## Method

The renderer was invoked locally with a synthetic person (990602), one synthetic subject (990604), and one synthetic character (990605). The five PNGs were opened and inspected individually at CSS viewport widths 320, 360, 520, 640, and 960 pixels. No Bangumi account, OAuth token, live API response, or remote image was used.

The same fixture was rendered at 640 and 960 pixel image widths and 320, 360, and 520 pixel CSS widths. The test also measured the document scroll width at 320, 360, and 520 pixels.

## Findings and changes

The first 320-pixel render showed the distribution lists extending beyond the card because their 260-pixel minimum width exceeded the available content width. The mobile layout now lets those lists shrink to the card width. Regression assertions check that the document scroll width stays at 320 pixels at 320/360/520 pixel viewports.

The profile card exposed raw English role/media labels and internal keys (`voice actor`, `anime`, `main`, `Person ID`, and `v0`), showed `(null)` for the missing blood type, and repeated untranslated field names in a warning. The card now localizes known labels, displays the official type code with a Chinese label, suppresses null blood type, and removes the redundant raw-key warning. Long mixed Chinese/Japanese text wraps without visible horizontal spill at the reviewed widths.

The no-image state remains explicit. The card is tall at narrow widths because the fixture intentionally includes a long summary, a subject, a character, and source limitations; all sections remain readable and the five images showed no clipped right edge after the fix.

## Render samples

The PNGs were generated in `/tmp` and are deliberately not committed. Their dimensions and SHA-256 values make the exact reviewed samples identifiable in this local run:

| CSS width | PNG dimensions | SHA-256                                                            |
| --------: | -------------: | ------------------------------------------------------------------ |
|       320 |     320 × 2007 | `de48c35e5941245d71cd90868d8e1da6dea8000c236c1148a97713949374e424` |
|       360 |     360 × 1865 | `efdf7a9436d13b11e0ac5382481caac2b4f18846dd17740f08d4b28cfac2f06b` |
|       520 |     520 × 1550 | `e2149214048eb61d3b9f4e2c728c4ac4a9e4cbb63d213f410aaba803994fe9be` |
|       640 |     640 × 1201 | `5ad7e59e8fe40d407c1113606a383d98ad8dce27807ede43e63e6c65e555252a` |
|       960 |      960 × 957 | `cf3dee7f05403f40f5eee5c7986e67f5c6d7020bf28bdf2e271f234ce5f04109` |

## Limits

This is synthetic offline renderer QA. It does not test OAuth, a signed-in account, a QQ/TIM client, remote asset delivery, real-person profile completeness, latest-20 ordering, ongoing-work classification, or the P06 user scenario. The P06 frontier must remain `UNASSESSED`; only a separately accepted P06 v2 Agent/MCP matrix report can add the `render_person_profile` matrix row.
