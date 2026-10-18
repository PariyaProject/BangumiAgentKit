# Run #95 candidate visual QA — render_collection_dashboard — 2026-10-19

## Scope and method

Reviewed the post-change render_collection_dashboard output on exact candidate commit 0f4e178d657868cfb609275955a32f8c312177f7. All 35 final PNGs below were opened individually at their recorded resolution. Fixtures are synthetic and local; the seven Dashboard scenarios used 9 mocked service fetches total. External requests: 0. No real account, credential, OAuth, QQ, TIM, or live Bangumi API was used. The renderer package build passed and the four focused service/render/dashboard/Standalone test files passed 9 tests; no acceptance matrix credit is added.

## Per-image receipt

| PNG | State | Width × height | Bytes | SHA-256 | Individual observation |
| --- | --- | ---: | ---: | --- | --- |
| `collection-dashboard-complete-320.png` | `complete` | 320×1374 | 134691 | `fcc938fbee7e3498271bcaa02a0be4b771a21943b71088b29721864fb14e2f39` | 展示内容明确为无省略；三个完成区段与计数一致。 320px：窄屏；长标题和正文在卡片内换行，未见裁切。 |
| `collection-dashboard-complete-360.png` | `complete` | 360×1224 | 133108 | `d53f0c3a13cea65beb4ea2c8886a8fc5d13ab3f30798b083350b179ee773b5b2` | 展示内容明确为无省略；三个完成区段与计数一致。 360px：两列摘要/纵向区段保持可读，未见裁切。 |
| `collection-dashboard-complete-520.png` | `complete` | 520×1054 | 133061 | `cdd5f9d7d7a3b15075c13639fafae123f69b0ea10013f7fff844cbf69eaabb68` | 展示内容明确为无省略；三个完成区段与计数一致。 520px：中等宽度分区与状态文本完整，未见裁切。 |
| `collection-dashboard-complete-640.png` | `complete` | 640×1007 | 133299 | `97aa7361146e4f47f8e1081c7ff31af1203d15bf1d017a885981329d79efffc8` | 展示内容明确为无省略；三个完成区段与计数一致。 640px：摘要和分区间距正常，未见裁切。 |
| `collection-dashboard-complete-960.png` | `complete` | 960×632 | 133785 | `c7e538ea30f36995b29de5576fef8b732a6975095321ca3500cb68adc19de60e` | 展示内容明确为无省略；三个完成区段与计数一致。 960px：宽屏区段并列，摘要保持边界，未见裁切。 |
| `collection-dashboard-empty-complete-320.png` | `complete` | 320×1391 | 136772 | `fe57300b6b8d96c399177b27f7a59272f8c7e11e95f640fc900169931e8cfb46` | 空收藏与空分区说明完整，展示内容为无省略。 320px：窄屏；长标题和正文在卡片内换行，未见裁切。 |
| `collection-dashboard-empty-complete-360.png` | `complete` | 360×1239 | 134922 | `a553debdc32586dfa9a50c4d435eba6689c1d1d681f83db9acb1e08523cc83aa` | 空收藏与空分区说明完整，展示内容为无省略。 360px：两列摘要/纵向区段保持可读，未见裁切。 |
| `collection-dashboard-empty-complete-520.png` | `complete` | 520×1054 | 134408 | `fad3b63e054252ba139748ddbe001696c6068568f04fc72cf7a86c7abfa368d0` | 空收藏与空分区说明完整，展示内容为无省略。 520px：中等宽度分区与状态文本完整，未见裁切。 |
| `collection-dashboard-empty-complete-640.png` | `complete` | 640×1007 | 136440 | `eb2aa76ccd1b4e6687598642ce2ebd27f078acc8090eba603765bc96d659987d` | 空收藏与空分区说明完整，展示内容为无省略。 640px：摘要和分区间距正常，未见裁切。 |
| `collection-dashboard-empty-complete-960.png` | `complete` | 960×632 | 136073 | `d8f57d7f8a0df3d381876fcb0455f4f6586274f2d071f319626d795af3b61963` | 空收藏与空分区说明完整，展示内容为无省略。 960px：宽屏区段并列，摘要保持边界，未见裁切。 |
| `collection-dashboard-dense-truncated-320.png` | `partial` | 320×1601 | 169309 | `56a8f98bb425a23299515fa6c22a929b74b75fa8b4ac867e1bb98d41da2249cd` | backlog 和七日计划各显示 4/7；顶部“有条目省略”与区段截断数一致。 320px：窄屏；长标题和正文在卡片内换行，未见裁切。 |
| `collection-dashboard-dense-truncated-360.png` | `partial` | 360×1420 | 169343 | `e5ced6abbec2c53ecfed5293a5c8730ff2554b121b169e2c0783bc29bfcef33e` | backlog 和七日计划各显示 4/7；顶部“有条目省略”与区段截断数一致。 360px：两列摘要/纵向区段保持可读，未见裁切。 |
| `collection-dashboard-dense-truncated-520.png` | `partial` | 520×1175 | 163627 | `82a847531b8183df95476c687406d598193c3f9d34b23305f923ed323e838bd3` | backlog 和七日计划各显示 4/7；顶部“有条目省略”与区段截断数一致。 520px：中等宽度分区与状态文本完整，未见裁切。 |
| `collection-dashboard-dense-truncated-640.png` | `partial` | 640×1113 | 163716 | `b1301f1a0c5e4687728cf3fcfd8f0e7a5159868d555a4ad006dbad72e18f55da` | backlog 和七日计划各显示 4/7；顶部“有条目省略”与区段截断数一致。 640px：摘要和分区间距正常，未见裁切。 |
| `collection-dashboard-dense-truncated-960.png` | `partial` | 960×738 | 173362 | `74cefce77efa8d3e3b817f4b22110726e246df24dd319585836d914ba0e6ff67` | backlog 和七日计划各显示 4/7；顶部“有条目省略”与区段截断数一致。 960px：宽屏区段并列，摘要保持边界，未见裁切。 |
| `collection-dashboard-partial-degraded-320.png` | `partial` | 320×1187 | 113144 | `a28a2c7a4d31eb12f51795dff27a82ba9d1c37ca3f89288902eaf63892f11f01` | 总状态为部分覆盖，同时展示内容为无省略；数据状态与呈现状态容易区分。 320px：窄屏；长标题和正文在卡片内换行，未见裁切。 |
| `collection-dashboard-partial-degraded-360.png` | `partial` | 360×1082 | 112507 | `55551bd71cbaa513e2edb3b4f8784ed417fa88ff87bdb38c314003e544f5f8ad` | 总状态为部分覆盖，同时展示内容为无省略；数据状态与呈现状态容易区分。 360px：两列摘要/纵向区段保持可读，未见裁切。 |
| `collection-dashboard-partial-degraded-520.png` | `partial` | 520×957 | 112855 | `337af333b1b7418336ebd534b7914b9548cdb8de1728b89385e7f8c03543910c` | 总状态为部分覆盖，同时展示内容为无省略；数据状态与呈现状态容易区分。 520px：中等宽度分区与状态文本完整，未见裁切。 |
| `collection-dashboard-partial-degraded-640.png` | `partial` | 640×925 | 113398 | `506a250e7c619e8ffbdeb30d3dc63d482a4c8e1865c11ab254fe378279d3f71e` | 总状态为部分覆盖，同时展示内容为无省略；数据状态与呈现状态容易区分。 640px：摘要和分区间距正常，未见裁切。 |
| `collection-dashboard-partial-degraded-960.png` | `partial` | 960×632 | 114290 | `aa216b39c2f9cd9dceeff2f3a40a5043d475dccbb2b37c155e8c6e90f2ad30e4` | 总状态为部分覆盖，同时展示内容为无省略；数据状态与呈现状态容易区分。 960px：宽屏区段并列，摘要保持边界，未见裁切。 |
| `collection-dashboard-auth-required-320.png` | `auth_required` | 320×1205 | 115765 | `7acce505ace61207acb6247b8703e7b7e70028eaf7ba38600dc9034d5cd53ac9` | 需要授权状态与零观察计数相符；展示内容状态仍单独标明无省略。 320px：窄屏；长标题和正文在卡片内换行，未见裁切。 |
| `collection-dashboard-auth-required-360.png` | `auth_required` | 360×1116 | 117709 | `9fef9d4cd802c41a2d1bcdc310255f08897b33ee1e7c3308401dcf75010f0eae` | 需要授权状态与零观察计数相符；展示内容状态仍单独标明无省略。 360px：两列摘要/纵向区段保持可读，未见裁切。 |
| `collection-dashboard-auth-required-520.png` | `auth_required` | 520×956 | 113637 | `2a9cfd0562ab187735f7cb5805fb60a8db890cf97b37585a316ee45ee05a0dde` | 需要授权状态与零观察计数相符；展示内容状态仍单独标明无省略。 520px：中等宽度分区与状态文本完整，未见裁切。 |
| `collection-dashboard-auth-required-640.png` | `auth_required` | 640×890 | 113392 | `21aa9cef679dd603bf42c1aee067976f297fe5507a059882d7836ff07895af67` | 需要授权状态与零观察计数相符；展示内容状态仍单独标明无省略。 640px：摘要和分区间距正常，未见裁切。 |
| `collection-dashboard-auth-required-960.png` | `auth_required` | 960×572 | 114863 | `0af52193488cf6fc02869b62d3d27888c461ec152c2c8054c0ca4e7171bdd4e5` | 需要授权状态与零观察计数相符；展示内容状态仍单独标明无省略。 960px：宽屏区段并列，摘要保持边界，未见裁切。 |
| `collection-dashboard-permission-denied-320.png` | `permission_denied` | 320×1135 | 110589 | `64783ac12927ed05506c188496cfce24ad6b0803fd02cec2b19093ad40366b65` | 无权限状态与零观察计数相符；展示内容状态不混同于数据可用性。 320px：窄屏；长标题和正文在卡片内换行，未见裁切。 |
| `collection-dashboard-permission-denied-360.png` | `permission_denied` | 360×1052 | 110716 | `8d6b650ffd88f9c404732e40899fd3339f7938106634fb8a2b9d84830d6df529` | 无权限状态与零观察计数相符；展示内容状态不混同于数据可用性。 360px：两列摘要/纵向区段保持可读，未见裁切。 |
| `collection-dashboard-permission-denied-520.png` | `permission_denied` | 520×907 | 110700 | `e85603395126e6b693005aca0c56d24791821c19a95407ebf1f80e993ac80c77` | 无权限状态与零观察计数相符；展示内容状态不混同于数据可用性。 520px：中等宽度分区与状态文本完整，未见裁切。 |
| `collection-dashboard-permission-denied-640.png` | `permission_denied` | 640×875 | 111078 | `ce17a8f8cc456db5d655ba0fb2165e36ae76784c0ab498b96d9e505e6d95c22c` | 无权限状态与零观察计数相符；展示内容状态不混同于数据可用性。 640px：摘要和分区间距正常，未见裁切。 |
| `collection-dashboard-permission-denied-960.png` | `permission_denied` | 960×572 | 108287 | `d6a813b3c5726e767ae8a7696d88316d29580d67292b448a0c261476e2c90510` | 无权限状态与零观察计数相符；展示内容状态不混同于数据可用性。 960px：宽屏区段并列，摘要保持边界，未见裁切。 |
| `collection-dashboard-upstream-error-320.png` | `upstream_error` | 320×1156 | 109104 | `77855ad4f2cffccc2f4a3dbbe766b8bacecf3c712de9397bfefb4e94ae7c425f` | 上游失败状态与零观察计数相符；展示内容状态仍单独标明无省略。 320px：窄屏；长标题和正文在卡片内换行，未见裁切。 |
| `collection-dashboard-upstream-error-360.png` | `upstream_error` | 360×1052 | 110631 | `fb5c1653b5aba06769f4d57e7c0c5aa5ba86736825158f7dca83446f8c841b99` | 上游失败状态与零观察计数相符；展示内容状态仍单独标明无省略。 360px：两列摘要/纵向区段保持可读，未见裁切。 |
| `collection-dashboard-upstream-error-520.png` | `upstream_error` | 520×907 | 112129 | `ba18ac7b51da57aafbbe654c255dbf9af9fcba2fd49b7c5ca89d500a3788fbc0` | 上游失败状态与零观察计数相符；展示内容状态仍单独标明无省略。 520px：中等宽度分区与状态文本完整，未见裁切。 |
| `collection-dashboard-upstream-error-640.png` | `upstream_error` | 640×875 | 111270 | `f267e56abccf84158d957d9753d6ab2ceccfa2bbacebe131aaf843567b0e5edf` | 上游失败状态与零观察计数相符；展示内容状态仍单独标明无省略。 640px：摘要和分区间距正常，未见裁切。 |
| `collection-dashboard-upstream-error-960.png` | `upstream_error` | 960×555 | 108021 | `16f02f580fa737386cbdf5e40c81a938d516c2e3b865836bf16332787266ea3b` | 上游失败状态与零观察计数相符；展示内容状态仍单独标明无省略。 960px：宽屏区段并列，摘要保持边界，未见裁切。 |

## Findings

- The new display line reads “无省略” when every available row is shown and “有条目省略” when the renderer omits rows. The mixed degraded case can therefore remain data-partial while clearly reporting that the visible output has no omissions.
- Dense cases still produce tall narrow cards and repeat section-level error text in a global summary. Permission-denied and upstream failures continue to expose machine codes; these are follow-up copy findings outside this correction.
- No visible clipping was found in any of the 35 final images.

## Legacy comparison

The legacy PHP and C++ projects include collection lists, progress, and subject replies, but neither audit found a direct equivalent of this three-section private Dashboard card. The comparison is limited to adjacent journeys and makes no whole-project parity claim.

Images and manifests remain in ignored local storage. This is candidate-only synthetic visual evidence; it does not establish real OAuth/account data, current QQ/TIM message delivery, or Agent/MCP acceptance.
