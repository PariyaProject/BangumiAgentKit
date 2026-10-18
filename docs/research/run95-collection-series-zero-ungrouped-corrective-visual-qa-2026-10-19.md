# Run #95 corrective visual QA — zero-cap confirmed ungrouped state

Date: 2026-10-19. This is a focused follow-up to the P2 finding on PR #231.
The rendered code is commit
`07657c29f0318cfa2490a957c8fb0f0ff51b64ba` on base
`476c6011918e0c3239a38551dfcb5a747f2dbb3d`.

## Fixture and result

- A deterministic local mock returns one synthetic eligible anime collection
  row with no observed relations. `maxUngrouped: 0` produces the expected
  ViewModel partition: available 1, rendered 0, omitted 1.
- The card now shows “另有 1 个已确认未归组条目未展示。” even when the row list
  is empty. The summary still reports one confirmed ungrouped item; it is not
  relabeled as unknown membership.
- The zero-cap render regression checks this count and visible notice at all five
  CSS widths below. Build and the focused renderer test passed before rendering.
- The five final PNGs were opened individually. The notice remains readable at
  each width, does not collide with the empty-series explanation or coverage
  details, and no clipping or horizontal overflow is visible.
- The fixture used 2 mocked service fetches and 0 external requests. No real
  account, credential, OAuth, QQ, TIM, or live Bangumi API was used; this adds no
  matrix, account, client, or stability acceptance credit.

## Individual image receipts

| PNG | Dimensions | Bytes | SHA-256 | Observation |
| --- | ---: | ---: | --- | --- |
| `collection-series-zero-ungrouped-320.png` | 320 × 823 | 81,402 | `cc8275195de679e87c6fd58c77a1f7f5896320d6852c3b565bf447272bef4096` | Notice readable below the no-series-group explanation; no clipping. |
| `collection-series-zero-ungrouped-360.png` | 360 × 791 | 82,192 | `268501f36ef9d0da841c0dcfa67e2f778d450048cf866df41a88feea55e4579a` | Notice remains a separate line above relation details; no clipping. |
| `collection-series-zero-ungrouped-520.png` | 520 × 658 | 81,395 | `1819b355b14680a62f73747a72874669cbaea3d48fe9555123c8f125699827fc` | Notice visible between the empty-state message and relation details. |
| `collection-series-zero-ungrouped-640.png` | 640 × 643 | 81,494 | `7465cc9b86587c9f91a8dec9a25e27eca4f60dd7ca0866a4582b06fe10a6f6ac` | Notice readable with adequate spacing; no clipping. |
| `collection-series-zero-ungrouped-960.png` | 960 × 481 | 80,090 | `093d448940ce6e02c450ffbae2bebd00d6a8a1819c01299e68b948bb7f455b36` | Notice remains visible in the summary flow; no clipping. |

PNG files and their manifest remain in ignored local artifacts at
`.artifacts/render/collection-series-zero-ungrouped-07657c2/`.
