# Renderer 2.0 data availability requirements

## 结论

Renderer 2.0 的数据模型必须把“有值”“来源稳定”“允许展示”“可计算”分开。S1/S2 可直接支撑 SubjectOverview、Cast、Staff、Episodes、Relations、基础 Calendar 和 core Stats；Stats 的 website-specific charts、CommunityTrending、PersonWorkload、CollectionDashboard 需要分别表达 S5/S3/S6/auth 状态。

**FACT**：当前 Renderer 视图模型缺少 evidence、freshness、coverage、confidence、missingFields、authScope；PR-7A 既有审计记录了五个模板和目标目录。

**EVIDENCE**：[`../renderer-product-audit.md`](../renderer-product-audit.md)、[`scenario-source-coverage.md`](scenario-source-coverage.md)、本轮 S1–S7 矩阵。

**REASONING**：不同 source class 的值不可只靠颜色/数字区分；同一个卡片可能同时有 official histogram、S5 web-specific chart、derived workload 和 private progress。

**CONFIDENCE**：HIGH。

**ALTERNATIVES**：可以先只显示官方字段，但必须保留 schema 扩展位；否则后续会把 source policy 硬编码进模板。

**IMPLEMENTATION IMPLICATION**：所有 view model 共享 `DataState`/`Evidence` envelope，Renderer 不自己发 HTTP、不自己猜 fallback。

## View × source availability

| View                | 当前可用数据                                                         | 缺口/状态                                  | 最小 evidence                            |
| ------------------- | -------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------- |
| SubjectOverview     | S1 detail、S2 calendar fields、S3 richer detail                      | locked/NSFW/图片失败                       | S1 + optional S3                         |
| SubjectDeepDive     | S1 episodes/cast/staff/relations/stats；S3 topics/reviews            | web-specific stats/正文/coverage           | S1 + S3/S5 per section                   |
| SearchResults       | S1 search/browse                                                     | concept ambiguity、sort/filter explanation | S1 + S7                                  |
| SeasonRanking       | S1 season/rating/rank                                                | historical/yearly ranking需要 S6           | S1 or S6                                 |
| Cast                | S1 subject characters/actors                                         | role normalization、partial pages          | S1 + S7                                  |
| Staff               | S1 persons + S7 role grouping                                        | fine-grained label unknown                 | S1 + S7                                  |
| PersonProfile       | S1 person/works/casts；S3 enriched profile                           | date/media/role coverage                   | S1 + optional S3                         |
| PersonWorkload      | raw S1 graph                                                         | aggregation formula、date gaps、trend      | S1 + S7；S6 for change                   |
| CommunityTrending   | S3 current topic/review/comment counts；S5 fallback                  | unknown heat definition、snapshot          | S3/S5 + S6 if growth                     |
| Stats               | score/rank/histogram/collection buckets from S1/S2; S7 completion/SD | web-specific cross-tabs/charts may be S5   | S1 + S7; S5 only for web-specific fields |
| Relations           | S1 edges + S7 traversal/order                                        | cycles/ambiguous order                     | S1 + S7                                  |
| CollectionDashboard | auth S1/S3 + S2 Calendar + episodes                                  | private boundary、remaining policy         | auth + source envelope                   |

## Shared state contract (proposal)

```ts
type DataState =
  | 'complete'
  | 'partial'
  | 'stale'
  | 'not_computable'
  | 'auth_required'
  | 'conflict'
  | 'unavailable';

type ViewEvidence = {
  state: DataState;
  sources: Evidence[];
  missingFields: string[];
  formulaVersion?: string;
  coverage?: { fetched: number; expected?: number; pages?: number };
};
```

## Visual acceptance updates

- Stats unavailable 和“分布为 0”必须是不同状态。
- S3/S5 stale 时保留 source/as-of，不显示“实时”。
- auth_required 不显示另一用户或脱敏错误的私有数据。
- conflict（例如 Calendar headline/item count）显示两个计数和来源。
- image/asset failure 不得吞掉 identity/title/score/evidence。
- derived graph/workload 必须显示窗口、过滤器、公式版本和 unresolved count。
