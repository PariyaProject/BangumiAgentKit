# Run #95 candidate visual QA — render_collection_series_groups — 2026-10-19

## Scope and method

Reviewed the post-change render_collection_series_groups output on exact candidate commit 0f4e178d657868cfb609275955a32f8c312177f7. All 45 final PNGs below were opened individually at their recorded resolution. Fixtures are synthetic and local; the nine series scenarios used 43 mocked service fetches total. External requests: 0. No real account, credential, OAuth, QQ, TIM, or live Bangumi API was used. The renderer package build passed and the four focused service/render/dashboard/Standalone test files passed 9 tests; no acceptance matrix credit is added.

## Per-image receipt

| PNG | State | Width × height | Bytes | SHA-256 | Individual observation |
| --- | --- | ---: | ---: | --- | --- |
| `collection-series-complete-320.png` | `complete` | 320×979 | 93731 | `8f18220862ba1c51e303402271db5ff6c89bf5ba9210b0dfe7f545c1c29c343f` | 数据覆盖完整；六个摘要数区分已确认未归组和关系待确认，分组与独立条目边界清楚。 320px：窄屏；长标题和正文在卡片内换行，未见裁切。 |
| `collection-series-complete-360.png` | `complete` | 360×947 | 94693 | `0386ece6373991b5f5b4dd75adafe83b345d322f73072928826b7c71d281843c` | 数据覆盖完整；六个摘要数区分已确认未归组和关系待确认，分组与独立条目边界清楚。 360px：两列摘要/纵向区段保持可读，未见裁切。 |
| `collection-series-complete-520.png` | `complete` | 520×801 | 93683 | `68695ab2190d3d389b18017e7abebf0ec4dc4dc225e7aa6c0fdc6a48a6055e99` | 数据覆盖完整；六个摘要数区分已确认未归组和关系待确认，分组与独立条目边界清楚。 520px：中等宽度分区与状态文本完整，未见裁切。 |
| `collection-series-complete-640.png` | `complete` | 640×786 | 96406 | `bce2b0f3178466ed3ac72ce83c5422b23d8ec1199f2146c2bdd4a086e42c66b5` | 数据覆盖完整；六个摘要数区分已确认未归组和关系待确认，分组与独立条目边界清楚。 640px：摘要和分区间距正常，未见裁切。 |
| `collection-series-complete-960.png` | `complete` | 960×623 | 98184 | `0c1c775b45a73b6395843c8f28f961bff85249aa7d932f479a105f165d1f947c` | 数据覆盖完整；六个摘要数区分已确认未归组和关系待确认，分组与独立条目边界清楚。 960px：宽屏区段并列，摘要保持边界，未见裁切。 |
| `collection-series-empty-complete-320.png` | `complete` | 320×792 | 78840 | `ac6a785ab549fea3cc987ca9f7a74f0dcb861616a27da87a7e45380e659b01dc` | 零收藏中已确认未归组与关系待确认均为零；卡片明确说明无确认系列组不等于收藏为空。 320px：窄屏；长标题和正文在卡片内换行，未见裁切。 |
| `collection-series-empty-complete-360.png` | `complete` | 360×760 | 79807 | `9742a9fbbe1874b9d61c875d9f1ffb9f54769f13f24d43aaf35055358f1d2a35` | 零收藏中已确认未归组与关系待确认均为零；卡片明确说明无确认系列组不等于收藏为空。 360px：两列摘要/纵向区段保持可读，未见裁切。 |
| `collection-series-empty-complete-520.png` | `complete` | 520×627 | 79004 | `27026222e6d901a01a361f2799642dc2e84c43c8aec5fd1d0febe135b6fe14f1` | 零收藏中已确认未归组与关系待确认均为零；卡片明确说明无确认系列组不等于收藏为空。 520px：中等宽度分区与状态文本完整，未见裁切。 |
| `collection-series-empty-complete-640.png` | `complete` | 640×612 | 79126 | `37e7beb7b3f5db21fe6b512d6809de99e5ee93ac1d80cfdefd8df0c57602f576` | 零收藏中已确认未归组与关系待确认均为零；卡片明确说明无确认系列组不等于收藏为空。 640px：摘要和分区间距正常，未见裁切。 |
| `collection-series-empty-complete-960.png` | `complete` | 960×450 | 77534 | `c7eed9382bb860e53d3d4475bc85783bd2dda0da5f08a03711354716f31759d3` | 零收藏中已确认未归组与关系待确认均为零；卡片明确说明无确认系列组不等于收藏为空。 960px：宽屏区段并列，摘要保持边界，未见裁切。 |
| `collection-series-conflict-320.png` | `conflict` | 320×957 | 91577 | `9f287b6bd6a3c661a5b4c5f4112aeb2250393a918ed0fae83c3800fc3bea6177` | 冲突徽标和红色警示保留；新增未知成员数为零，不稀释冲突状态。 320px：窄屏；长标题和正文在卡片内换行，未见裁切。 |
| `collection-series-conflict-360.png` | `conflict` | 360×904 | 92510 | `03dad832979202178d2475ad04f2f9d7116dcac0ebc7ebcb12b594040e599193` | 冲突徽标和红色警示保留；新增未知成员数为零，不稀释冲突状态。 360px：两列摘要/纵向区段保持可读，未见裁切。 |
| `collection-series-conflict-520.png` | `conflict` | 520×779 | 92085 | `d8c09d58094fac1d0e7a2fa354a1f2d09ccf27f8d7f443836e66a990cb43353c` | 冲突徽标和红色警示保留；新增未知成员数为零，不稀释冲突状态。 520px：中等宽度分区与状态文本完整，未见裁切。 |
| `collection-series-conflict-640.png` | `conflict` | 640×764 | 94902 | `c90910bbcdc9cfa2b3ed371ce527ea3487beefc5ca386f65fbeb3b589c075f5d` | 冲突徽标和红色警示保留；新增未知成员数为零，不稀释冲突状态。 640px：摘要和分区间距正常，未见裁切。 |
| `collection-series-conflict-960.png` | `conflict` | 960×601 | 96376 | `5802c7189553d2194426f9e1ee466755dc841e0f9c85cd5cb10d5d7ae2f81761` | 冲突徽标和红色警示保留；新增未知成员数为零，不稀释冲突状态。 960px：宽屏区段并列，摘要保持边界，未见裁切。 |
| `collection-series-partial-relation-failure-320.png` | `partial` | 320×963 | 97712 | `4168ad9f305da24bd6e42756ddcc93c8d82c2b746d635e161662ca2331c2e89e` | 关系读取失败的第一部进入“关系待确认”，第二/三部保留在已确认未归组；计数为 1 对 2。 320px：窄屏；长标题和正文在卡片内换行，未见裁切。 |
| `collection-series-partial-relation-failure-360.png` | `partial` | 360×931 | 98927 | `3487ca18c70399188adca52d0c85e7d8456ea46fac47be94becdfb99d043104c` | 关系读取失败的第一部进入“关系待确认”，第二/三部保留在已确认未归组；计数为 1 对 2。 360px：两列摘要/纵向区段保持可读，未见裁切。 |
| `collection-series-partial-relation-failure-520.png` | `partial` | 520×783 | 98071 | `d33f05e5ad48926f8684a37fb59b4f7c1655f1da829e4ea8b80fdaf574d33507` | 关系读取失败的第一部进入“关系待确认”，第二/三部保留在已确认未归组；计数为 1 对 2。 520px：中等宽度分区与状态文本完整，未见裁切。 |
| `collection-series-partial-relation-failure-640.png` | `partial` | 640×768 | 98601 | `d00236d4ca116e0be53c772ecd64454efe160b2a17e8d33260cfa4b07e569ea5` | 关系读取失败的第一部进入“关系待确认”，第二/三部保留在已确认未归组；计数为 1 对 2。 640px：摘要和分区间距正常，未见裁切。 |
| `collection-series-partial-relation-failure-960.png` | `partial` | 960×606 | 97753 | `68e4fc74c015e96e50c349cffe9db464e920d62380fd4feccc25125f25bd1210` | 关系读取失败的第一部进入“关系待确认”，第二/三部保留在已确认未归组；计数为 1 对 2。 960px：宽屏区段并列，摘要保持边界，未见裁切。 |
| `collection-series-dense-truncated-320.png` | `complete` | 320×2514 | 301010 | `2704c062624b7e5abd24506e1b42b82880c79ec85c0b02a6ab5270ebbe62e986` | 数据覆盖状态与显示数量分开说明；10 组中明确展示 8 组并省略 2 组。 320px：窄屏；长标题和正文在卡片内换行，未见裁切。 |
| `collection-series-dense-truncated-360.png` | `complete` | 360×2483 | 306058 | `880c9562ae08c0b2085baf8c6c70d9a7dd76aadfcd54fc4e9861afc1d0163ff1` | 数据覆盖状态与显示数量分开说明；10 组中明确展示 8 组并省略 2 组。 360px：两列摘要/纵向区段保持可读，未见裁切。 |
| `collection-series-dense-truncated-520.png` | `complete` | 520×1838 | 325113 | `1da55f8a2ded7156b685234609837997ba66a16bf545aec8a63227e5e4528c62` | 数据覆盖状态与显示数量分开说明；10 组中明确展示 8 组并省略 2 组。 520px：中等宽度分区与状态文本完整，未见裁切。 |
| `collection-series-dense-truncated-640.png` | `complete` | 640×1673 | 321267 | `f5ab1e31b594c217d6cf4d27aef4e6c42d2e81c38d8906c59e2962980b42605a` | 数据覆盖状态与显示数量分开说明；10 组中明确展示 8 组并省略 2 组。 640px：摘要和分区间距正常，未见裁切。 |
| `collection-series-dense-truncated-960.png` | `complete` | 960×1421 | 349561 | `be087cc038ff111e2d974c0233b69a9346a852c3f257de7e817bca43e82ee9b6` | 数据覆盖状态与显示数量分开说明；10 组中明确展示 8 组并省略 2 组。 960px：宽屏区段并列，摘要保持边界，未见裁切。 |
| `collection-series-auth-required-320.png` | `auth_required` | 320×782 | 68227 | `08dbb68e696770b87815a1d4001d398e8265a131039726984574c08a26e45e14` | 需要授权、机器错误码及零成员计数可见；新增关系待确认数为零。 320px：窄屏；长标题和正文在卡片内换行，未见裁切。 |
| `collection-series-auth-required-360.png` | `auth_required` | 360×744 | 68672 | `56cae98f7b6fff4b75b9d93d8e44d70482214b80009e033d1006e2dc7c9c5f26` | 需要授权、机器错误码及零成员计数可见；新增关系待确认数为零。 360px：两列摘要/纵向区段保持可读，未见裁切。 |
| `collection-series-auth-required-520.png` | `auth_required` | 520×631 | 68412 | `58cb00df7bf9be19881243f5f583f7e1f32a17e493c221890c14db50a4f8247d` | 需要授权、机器错误码及零成员计数可见；新增关系待确认数为零。 520px：中等宽度分区与状态文本完整，未见裁切。 |
| `collection-series-auth-required-640.png` | `auth_required` | 640×631 | 69474 | `a8a11e67180d49eeb209e63ab507703a4aabcae634a526f7e61c2c5c74a3bd8d` | 需要授权、机器错误码及零成员计数可见；新增关系待确认数为零。 640px：摘要和分区间距正常，未见裁切。 |
| `collection-series-auth-required-960.png` | `auth_required` | 960×498 | 68158 | `18656911662937e6f5a97251906ead518c6b058e6a0d247559505d70c9c76ddb` | 需要授权、机器错误码及零成员计数可见；新增关系待确认数为零。 960px：宽屏区段并列，摘要保持边界，未见裁切。 |
| `collection-series-permission-denied-320.png` | `permission_denied` | 320×782 | 69250 | `4a2bbf5bf18146e23def8fdd37720d5b58ae22abac6734dbbed9394bb1c5b418` | 无权限状态、原始错误码和零成员计数可见；未见裁切。 320px：窄屏；长标题和正文在卡片内换行，未见裁切。 |
| `collection-series-permission-denied-360.png` | `permission_denied` | 360×744 | 69674 | `1e94538221575a65bf35cb7e0fa7c1f905cda46d8d869babc1b721d1d4d27521` | 无权限状态、原始错误码和零成员计数可见；未见裁切。 360px：两列摘要/纵向区段保持可读，未见裁切。 |
| `collection-series-permission-denied-520.png` | `permission_denied` | 520×631 | 69347 | `caea674cf0fb714230c8065e05797ee9c029f8f31270627295018211c909c54c` | 无权限状态、原始错误码和零成员计数可见；未见裁切。 520px：中等宽度分区与状态文本完整，未见裁切。 |
| `collection-series-permission-denied-640.png` | `permission_denied` | 640×631 | 70426 | `a6e850f6afe07a6afcf196737b704a332f91530e71b6077fd79ed808c18bc46e` | 无权限状态、原始错误码和零成员计数可见；未见裁切。 640px：摘要和分区间距正常，未见裁切。 |
| `collection-series-permission-denied-960.png` | `permission_denied` | 960×498 | 69153 | `e35c7fdc24496057d76c854e96ced765c9756306b3cf8d9c2e8c3c3ea25b8e73` | 无权限状态、原始错误码和零成员计数可见；未见裁切。 960px：宽屏区段并列，摘要保持边界，未见裁切。 |
| `collection-series-rate-limited-320.png` | `rate_limited` | 320×782 | 68494 | `eb7c82fd29d137a0fe331cd9cf1bd524dde39aad3dcb4f7dd8b99dec2e10d2ae` | 稍后重试提示清楚，原始错误码仍可见；未见裁切。 320px：窄屏；长标题和正文在卡片内换行，未见裁切。 |
| `collection-series-rate-limited-360.png` | `rate_limited` | 360×744 | 68934 | `5b28446c8dbe0667e81443b480cff35a946a926d5fcd75001484586ee09f2f97` | 稍后重试提示清楚，原始错误码仍可见；未见裁切。 360px：两列摘要/纵向区段保持可读，未见裁切。 |
| `collection-series-rate-limited-520.png` | `rate_limited` | 520×631 | 68698 | `f84c71c2879fd48be9c2c379381d7a14893af94f20463c1b0b789247488a930c` | 稍后重试提示清楚，原始错误码仍可见；未见裁切。 520px：中等宽度分区与状态文本完整，未见裁切。 |
| `collection-series-rate-limited-640.png` | `rate_limited` | 640×631 | 69746 | `9c9f42c5427ca60e4e450ac7b45f3dd3398ee8363d3c4c30c43dcd8ae340a077` | 稍后重试提示清楚，原始错误码仍可见；未见裁切。 640px：摘要和分区间距正常，未见裁切。 |
| `collection-series-rate-limited-960.png` | `rate_limited` | 960×498 | 68462 | `a43c89d82c7074626ac69a2965415ee5c0e2f70f16988416e47b5c34199fbe4a` | 稍后重试提示清楚，原始错误码仍可见；未见裁切。 960px：宽屏区段并列，摘要保持边界，未见裁切。 |
| `collection-series-upstream-error-320.png` | `upstream_error` | 320×782 | 69821 | `b984e64b7272ce284803c4ef0fe638832192b8deaa57d33284667e48066884e2` | 上游错误和稍后重试提示清楚，原始错误码仍可见；未见裁切。 320px：窄屏；长标题和正文在卡片内换行，未见裁切。 |
| `collection-series-upstream-error-360.png` | `upstream_error` | 360×744 | 70238 | `29f5c68c58164f69a135dd2c2422e2363a30b9014fc8a701cf08161ba4d2d9f8` | 上游错误和稍后重试提示清楚，原始错误码仍可见；未见裁切。 360px：两列摘要/纵向区段保持可读，未见裁切。 |
| `collection-series-upstream-error-520.png` | `upstream_error` | 520×631 | 69851 | `8eb6324768b4ffb50af2d0071932fd3cff7ef470bf13946945b4b28cc4130a08` | 上游错误和稍后重试提示清楚，原始错误码仍可见；未见裁切。 520px：中等宽度分区与状态文本完整，未见裁切。 |
| `collection-series-upstream-error-640.png` | `upstream_error` | 640×631 | 70919 | `06c2f482cf9f463593b85ca3389298106e94155aab83bd627c30226c04599824` | 上游错误和稍后重试提示清楚，原始错误码仍可见；未见裁切。 640px：摘要和分区间距正常，未见裁切。 |
| `collection-series-upstream-error-960.png` | `upstream_error` | 960×498 | 69651 | `2fefa73d74f44542db3d5a1309ee31702ae100c6d08d55c7f56c7b11de387f2a` | 上游错误和稍后重试提示清楚，原始错误码仍可见；未见裁切。 960px：宽屏区段并列，摘要保持边界，未见裁切。 |

## Findings

- Group membership now partitions observed eligible anime items into grouped, confirmed ungrouped, and relationship-unknown counts. Failed, unrequested, or truncated relation reads appear in a separate “关系待确认” section unless an observed edge already places that item in a group.
- The complete state now names data coverage explicitly; a dense card separately reports 8/10 displayed groups. The 320px dense card remains very tall and relation detail is dense.
- Auth/permission/upstream failure cards still show raw error codes and the generic failure message; those copy issues are recorded separately and were not changed here.
- No visible clipping was found in any of the 45 final images.

## Legacy comparison

The old C++ subject-detail journey includes related subjects as messages; neither legacy audit identifies an account-scoped connected-component collection-series renderer. The older 1920×898 artifact measurement is not visual proof. No direct image parity or whole-project superiority claim is established.

Images and manifests remain in ignored local storage. This is candidate-only synthetic visual evidence; it does not establish real OAuth/account data, current QQ/TIM message delivery, or Agent/MCP acceptance.
