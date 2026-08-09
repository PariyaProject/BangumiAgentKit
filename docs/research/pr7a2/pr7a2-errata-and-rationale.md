# PR-7A2 errata and rationale

本表列出相对于 PR-7A 研究产物的全部实质性更正/细化；不修改 PR-7A 历史文件，避免改写已交付证据。

| PR-7A 口径                                     | PR-7A2 更正                                                                                                                                                         | 理由                                                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| “Calendar 不是 v0 operation”                   | 精确为：当前 legacy `/calendar` 是 1 项 S2 operation，v0 没有等价 operation；推荐 legacy + v0 hydration                                                             | 避免把“非 v0”误读为“非官方/不可用”                                                                        |
| official API 统计只强调 v0                     | 明确 v0 55 + current legacy 1 = 56 documented family operations；历史 legacy 峰值 14                                                                                | legacy 历史删除/弃用需要单独审计                                                                          |
| community broadly “no official API”            | 改为“无完整 S1/S2 community contract；官方 frontend S3 private API 覆盖多项 community read”                                                                         | 新发现 `frontend/packages/client/api.yaml` 与 live `/p1/*`                                                |
| HTML 是主要 community 方案                     | 改为 S3 structured 优先、S5 allowlist fallback、S6 snapshots for growth                                                                                             | p1 提供 topics/comments/reviews/groups/trending shape，但稳定性未批准                                     |
| source matrix 将 Calendar/API/HTML 混为一行    | 按 S1–S8、字段级 provenance 与 conflict state 拆分                                                                                                                  | legacy collection、p1 watchers、website headline 不是同一语义                                             |
| website data 主要按页面可见字段                | 增加 `next.bgm.tv` SPA shell 与 `/p1` data layer                                                                                                                    | 页面壳与数据 endpoint 是不同 surface                                                                      |
| user data 主要按 v0/HTML                       | 增加 p1 public profile/collections/timeline/blogs/groups，并强调 auth/privacy                                                                                       | public sample 不证明全部用户/私有字段公开                                                                 |
| person/seiyuu 主要以 v0 graph 为主             | 保留 v0 canonical graph，增加 p1 role/filter/works/casts 为内部 structured accelerator                                                                              | S3 更细但 role semantics/shape 不等同 v0                                                                  |
| stats 将 histogram/基础 distribution 归为 HTML | 更正为：S1 Subject 直接提供 rating.count[1..10] 与五类 collection；completion/percentage/mean/population SD 为 S1+S7；S5 只保留 website-specific charts/definitions | 官方 server Subject schema、v0 response ref、legacy schema 和 5 个 stats page samples 纠正了 source class |
| 103 coverage 将 5 个 stats 场景归为 S5         | G08/G15/G23/A01/A05 全部移至 API+S7；分布更新为 81/13/0/8/1                                                                                                         | core raw inputs 已在 S1，HTML 不是这些场景的最小证据                                                      |
| Renderer 只需字段                              | 增加 source/state/evidence/freshness/coverage/auth/formula 需求                                                                                                     | 103 场景含 partial、stale、not-computable、private                                                        |
| road map 可直接进入 HTML provider              | 调整为先 Provider/evidence/snapshot 基础，再 gated S3/S5                                                                                                            | 降低不可逆 parser/terms coupling                                                                          |
| Calendar website count 可作为事实              | 分开 `reportedSeasonCount`、visible unique count、today count/watchers                                                                                              | 研究取样 observed 116 vs 115，不能强行统一                                                                |

## 不变项

- PR-7A v0 OpenAPI 固定基线和 55 operations 不变。
- 不把 frontend private API 生成进官方 v0 operation registry。
- 不对上游/站点许可证、条款或正文再分发作未经证实的法律结论。
- 不把 current count 当 historical snapshot，不因覆盖率压力猜测缺失字段。
- 本轮不修改 production runtime，不实施 HTML Provider，不启动 PR-7B。
