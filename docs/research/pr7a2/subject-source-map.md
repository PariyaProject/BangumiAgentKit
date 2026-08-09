# Subject source map

## 结论

条目核心 identity、评分、标签、集数和关系已有 S1 v0 覆盖；Calendar 集合字段由 S2 补充；新版网页的 infobox/meta tags、社区、推荐和收藏用户面则由 S3 结构化 API 提供更直接的观察。Subject 的总体评分分布和 collection buckets 也是 S1 原始字段；S5 只保留网站特有的交叉分布、解释文案和其他未被 S1/S2/S3 证明的统计。

**FACT / EVIDENCE**：官方 server 的 [`subject_v0.yaml`](https://raw.githubusercontent.com/bangumi/server/master/openapi/components/subject_v0.yaml) 声明 `Subject.rating.rank/total/score/count[1..10]` 与 `Subject.collection.wish/collect/doing/on_hold/dropped`；[`v0.yaml`](https://raw.githubusercontent.com/bangumi/server/master/openapi/v0.yaml) 的 `GET /v0/subjects/{subject_id}` 200 schema 明确 `$ref: "#/components/schemas/Subject"`，server handler 通过 [`ToSubjectV0`](https://github.com/bangumi/server/blob/master/web/res/subject.go) 返回该结构。S2 [`api.yml`](https://raw.githubusercontent.com/bangumi/api/master/open-api/api.yml) 的 `Legacy_SubjectSmall` 也声明 rating 分桶和五类 collection；S3 live `/p1/subjects/41529` 返回 detail rating/collection，但不改变 S1 contract。

**REASONING**：总体 histogram 与 bucket 的必要 raw inputs 已由 S1 明确定义；completion、percentage、mean、population SD 等可由 S7 透明计算。网页 stats 仍有额外交叉分布和定义，但不能因为页面重复显示 S1 字段就把它们标为 HTML-required。

**CONFIDENCE**：HIGH（样本 subject 41529；字段可变，具体 coverage MEDIUM）。

**ALTERNATIVES**：不同 subject 的 locked/NSFW/缺失字段可能少于样本；旧 HTML 仍可能显示 S3 schema 未暴露的区块。

**IMPLEMENTATION IMPLICATION**：`SubjectProvider` 先取 S1，按 capability 选择 S2/S3/S5；结果模型允许 field-level `missing`、`conflict` 和 `sourceEvidence[]`。

## 字段级矩阵

| 字段/能力                         | S1 v0                                                                    | S2 legacy                                          | S3 p1                                              | S4 embedded            | S5 HTML                | S6/S7                                           |
| --------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------- | -------------------------------------------------- | ---------------------- | ---------------------- | ----------------------------------------------- |
| id、url、name、name_cn            | 直接                                                                     | Calendar item                                      | `id/name/nameCN`                                   | 未发现可复用 hydration | 可见                   | S7 name normalization                           |
| summary、air date、type、platform | 直接/subject detail                                                      | Calendar small 有基本字段                          | detail `airtime/platform/summary/type`             | 未证明                 | 可见/分区              | date normalization                              |
| images                            | subject/image redirect                                                   | `images`                                           | `images`                                           | 图片 URL 可能在 style  | cover/img              | asset hash                                      |
| eps / episode count               | subject/episodes                                                         | `eps/eps_count`                                    | `eps`/episodes                                     | 未证明                 | ep 列表                | main/special policy                             |
| rating score/count/rank           | 直接                                                                     | `rating/rank`                                      | `rating`                                           | 未发现                 | 可见摘要               | score bins                                      |
| rating histogram                  | **直接：`rating.count[1..10]`**                                          | `rating.count[1..10]`                              | detail 有 rating，但非 S1 contract                 | 未发现                 | 页面重复显示/交叉图表  | percentages/SD/shape                            |
| collection bucket                 | **直接：五类 `collection` bucket**                                       | `wish/collect/doing/on_hold/dropped`               | detail `collection`                                | 未证明                 | 页面重复显示/交叉图表  | completion/proportions                          |
| tags/meta tags                    | tags/search fields                                                       | 不稳定/非主要字段                                  | `tags/metaTags`                                    | 未发现                 | tag links/count        | concept candidates                              |
| infobox/aliases                   | 部分 schema/subject info                                                 | 不作为 small contract                              | `infobox/info`                                     | 未发现                 | 页面表格               | alias normalization                             |
| characters/CV                     | `/subjects/{id}/characters`                                              | medium/large schema有关系字段但非 current path     | `/characters`、casts                               | 未证明                 | characters 页面        | cast dedupe/intersection                        |
| staff/职位                        | `/subjects/{id}/persons`                                                 | medium/large schema                                | `/staffs/persons/positions`                        | 未证明                 | persons 页面           | role normalization                              |
| relations/series                  | subject relations                                                        | legacy small 不足                                  | `/relations`                                       | 未发现                 | relation section       | graph/order                                     |
| episodes/title/date/duration/type | `/episodes`                                                              | legacy episode schemas                             | `/episodes`                                        | 未发现                 | `/ep`                  | missing/conflict check                          |
| comments/reviews/topics           | 部分 subject/community operations                                        | legacy topic/blog schemas但无 current general path | `/comments`,`/reviews`,`/topics`                   | 未发现                 | board/comments/reviews | sampling/snapshot                               |
| indexes/recs/collects             | v0 index/collection surface（按 operation）                              | large schema topic/blog                            | `/indexes`,`/recs`,`/collects`                     | 未发现                 | links/sections         | deterministic joins                             |
| stats / completion                | rating histogram、collection buckets 直接可用；completion raw inputs可用 | legacy Calendar summary 可用                       | detail rating/collection observed，非公共 contract | 未发现                 | 仅网站特有统计/定义    | **S7：completion、百分比、mean、population SD** |

## Stats source layers

### LEVEL A — S1 raw

`Subject.rating` 是 `rank`、`total`、`score` 和 `"1"`…`"10"` count；`Subject.collection` 是 `wish`、`collect`、`doing`、`on_hold`、`dropped`。这些字段由 `GET /v0/subjects/{subject_id}` 的 `Subject` response 返回。S2 Calendar 的 `Legacy_SubjectSmall` 具有等价 summary fields，但其命名/契约仍独立。

### LEVEL B — S7 derived

| Metric                             | S1 raw available                 | S3 available                          | S5 only                       | S7 derivable                       |
| ---------------------------------- | -------------------------------- | ------------------------------------- | ----------------------------- | ---------------------------------- |
| score / rank / rating total        | Yes                              | observed rating/detail shape          | 页面重复显示                  | No（raw）                          |
| rating histogram 1–10              | **Yes**                          | 未作为稳定公共 contract 证明          | 页面 chart 有，但不是必需来源 | No（raw）                          |
| rating percentage by score         | Yes                              | raw shape varies                      | chart may display             | **Yes**                            |
| mean / score diagnostic            | Yes                              | rating observed                       | page displays rounded value   | **Yes**                            |
| population standard deviation      | Yes                              | raw histogram未作为稳定 contract 证明 | page displays rounded value   | **Yes**                            |
| distribution shape / concentration | Yes                              | raw detail if sufficient              | page visualization            | **Yes**，formula must be versioned |
| collection buckets                 | **Yes**                          | collection observed                   | 页面重复显示                  | No（raw）                          |
| collection proportions             | Yes                              | collection observed                   | page displays completion      | **Yes**                            |
| completion rate                    | Yes：五 bucket total + `collect` | collection observed                   | formula/definition evidence   | **Yes**                            |

### LEVEL C — S5 web-specific

| Website stats field                                    | S1  | S3           | S4/S5 only | S7 from current Subject raw alone |
| ------------------------------------------------------ | --- | ------------ | ---------- | --------------------------------- |
| rating by collection type (`interest_type`)            | No  | Not verified | **Yes**    | No                                |
| user collection-volume distribution (`total_collects`) | No  | Not verified | **Yes**    | No                                |
| user registration-time distribution (`regdate`)        | No  | Not verified | **Yes**    | No                                |
| rating time since registration (`relative_regdate`)    | No  | Not verified | **Yes**    | No                                |
| VIB rating distribution                                | No  | Not verified | **Yes**    | No                                |
| broadcast-time distribution (`airdate`)                | No  | Not verified | **Yes**    | No                                |
| stats-page explanatory definitions / Beta labels       | No  | Not verified | **Yes**    | No                                |

The page exposes these charts in `CHART_SETS`, including `interest_type`, `airdate`, `total_collects`, `regdate`, `relative_regdate`, and `vib`; the presence of a chart is evidence for S5 availability, not a claim that all underlying formulas are public or reproducible.

## Completion and standard deviation verification

For five read-only samples, the website's displayed completion equals:

```
completion = collect / (wish + collect + doing + on_hold + dropped)
```

and the displayed SD equals the population formula over the v0 `rating.count` buckets, rounded to two decimals:

```
N        = Σ count_i
mean     = Σ(i × count_i) / N
variance = Σ(count_i × (i - mean)^2) / N
SD       = sqrt(variance)
```

| Subject | S1 collection sum | S1 collect | S5 completion | S1 population SD | S5 SD |
| ------: | ----------------: | ---------: | ------------: | ---------------: | ----: |
|   41529 |              9118 |       6706 |         73.5% |          1.20134 |  1.20 |
|       1 |               199 |        128 |         64.3% |          1.35768 |  1.36 |
|       8 |             32656 |      29176 |         89.3% |          1.25874 |  1.26 |
|      89 |                64 |         53 |         82.8% |          1.10701 |  1.11 |
|     202 |                12 |          5 |         41.7% |          1.60000 |  1.60 |

**FACT**：五个样本的 S1 raw data 与 S5 page values 一致到页面显示精度。

**EVIDENCE**：S1 samples from [`GET /v0/subjects/{subject_id}`](https://api.bgm.tv/v0/subjects/41529) and corresponding official stats pages [`41529/stats`](https://bgm.tv/subject/41529/stats), [`1/stats`](https://bgm.tv/subject/1/stats), [`8/stats`](https://bgm.tv/subject/8/stats), [`89/stats`](https://bgm.tv/subject/89/stats), [`202/stats`](https://bgm.tv/subject/202/stats), retrieved 2026-08-09 with a read-only identifying UA.

**REASONING**：completion 的分母正好是五个 S1 collection bucket 的和；population SD 的除数是 `N`，两位小数显示在五个样本上均吻合。公式已足够支持 runtime 的 S1+S7 calculation；S5 仍保留为 definition/rounding evidence。

**CONFIDENCE**：HIGH for the observed current website implementation; MEDIUM for an undocumented invariant across future site versions. Runtime should version the formula and keep the S5 evidence link.

**ALTERNATIVES**：网站后端未来可能更改定义或过滤样本；若 S5 value 与 S1+S7 diverges, return `conflict` and do not silently replace the official raw data.

**IMPLEMENTATION IMPLICATION**：Stats provider should compute core completion and population SD from S1; HTML is not required for G08/G15/G23/A01/A05. A separate S5 adapter may expose the web-specific charts with explicit `HTML_OBSERVED` status.

## 代表样本

样本 `subject/41529` 及 1、8、89、202 用于公式交叉验证，不是数据质量基准。实现前仍应增加正在放送、剧场版、信息锁定/缺少中文名等样本，并记录 retrieval time 和 HTTP status。
