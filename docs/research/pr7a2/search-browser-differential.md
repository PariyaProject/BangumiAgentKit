# Search / browser differential

## 结论

搜索与浏览要拆成四个面：S1 v0 search/browse contract、已删除的 S2 legacy keyword search、S3 p1/frontend structured discovery、S5 old website browser/tag/ranking。它们的 filter/sort 词汇和结果口径不能互换。

**FACT**：v0 有 `POST /v0/search/subjects` 和 `GET /v0/subjects`；legacy `GET /search/subject/{keywords}` 已在 2025 删除；旧网页 `/anime/browser` 可见 sort/年份/月/首字母等控件；官方 frontend private schema 另外提供 p1 discovery/trending/query endpoints。

**EVIDENCE**：[`v0.yaml`](https://raw.githubusercontent.com/bangumi/api/master/open-api/v0.yaml)、legacy 删除 commit [`9b4e4267c0`](https://github.com/bangumi/api/commit/9b4e4267c0)、[`bgm.tv/anime/browser`](https://bgm.tv/anime/browser)、[`frontend/packages/client/api.yaml`](https://github.com/bangumi/frontend/blob/master/packages/client/api.yaml)。

**REASONING**：不能因为 website 有“trend/rank/tag”控件就声称 v0 支持相同 filter；也不能恢复已删除 legacy search。Query planner 应选择 source-native capability，并在结果中显示 filter actually applied。

**CONFIDENCE**：v0/legacy HIGH；S3/HTML 的精确结果排序和覆盖 MEDIUM。

**ALTERNATIVES**：网页 browser 可能 server-side 组合多个数据源；p1 schema 的 path 可能尚未被当前旧站全部使用。

**IMPLEMENTATION IMPLICATION**：统一 Query AST 只表达语义，Provider capabilities 决定可下推谓词；未下推的 tag/concept/date 条件必须本地过滤且标 `partial/derived`，不返回“精确官方搜索”假象。

## capability 对照

| 维度             | S1 v0                                                           | S2 legacy                               | S3 p1                                | S5 website                 |
| ---------------- | --------------------------------------------------------------- | --------------------------------------- | ------------------------------------ | -------------------------- |
| keyword search   | `POST /v0/search/subjects`                                      | old `/search/subject/{keywords}` 已删除 | frontend query/search surface        | browser search box         |
| subject browse   | `GET /v0/subjects`，type/cat/series/platform/year/month/sort 等 | 无当前等价                              | p1 search/trending/subject list      | `/anime/browser`           |
| tag/concept      | `meta_tags/tag` 等字段/搜索 filter                              | 无 current general search               | p1 tags/search 形态依版本            | `/anime/tag/*` 与控制项    |
| rank/heat/trends | v0 sort/filter 可提供部分 score/rank                            | 无 current                              | `/trending/subjects` requires `type` | trends/rank 页面口径不透明 |
| pagination       | v0 limit/offset 与 cursor 取决 operation                        | old max_results 已历史删除              | p1 limit/offset，部分 max            | HTML page links/不可稳定   |
| total count      | response schema/operation-specific                              | 历史 `results/list`                     | `{data,total}` 常见但不统一          | 页面文案/结果数可能聚合    |

## 主要 differential

1. **Search**：S1 是可验证公共契约；S2 old search 仅作为迁移史；S3 是网站内部结构化面；S5 是用户可见控件。结果需要记录 `provider`, `sort`, `filtersApplied`, `filtersNotApplied`。
2. **Browser**：网页允许用户组合 season/type/sort；S1 可能需要多个请求或本地 query planner。不能把网页表单选项直接序列化成 v0 query。
3. **Tag**：网页 tag 可能有别名/计数/排序，v0 subject tags 是条目字段；概念解析仍是 S7/候选解释，不是官方 ontology。
4. **Trend**：p1 `type` 是必填，缺失时 live 400；这证明 Provider 需要 endpoint-specific validation。

## 结果安全规则

- 已删除 legacy search 不重试、不进入 fallback。
- S5 browser 抓取到的结果只标 HTML observed；不把页面排名重命名为官方 rank。
- S3 query response shape mismatch 时停用该 query capability；不按字段名猜测。
- Query AST 必须返回 exact/ambiguous/unsupported 状态，以及 as-of 和 source URL。
