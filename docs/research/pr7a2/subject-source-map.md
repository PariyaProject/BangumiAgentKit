# Subject source map

## 结论

条目核心 identity、评分、标签、集数和关系已有 S1 v0 覆盖；Calendar 集合字段由 S2 补充；新版网页的 infobox/meta tags、社区、推荐和收藏用户面则由 S3 结构化 API 提供更直接的观察。统计分布仍以 S5 stats 页面为当前已验证来源。

**FACT / EVIDENCE**：v0 schema [`open-api/v0.yaml`](https://raw.githubusercontent.com/bangumi/api/master/open-api/v0.yaml) 声明 subject/episode/person/character/relationship operations；S2 [`api.yml`](https://raw.githubusercontent.com/bangumi/api/master/open-api/api.yml) 的 `Legacy_SubjectSmall` 声明 Calendar 所需 summary/rating/collection；S3 live `/p1/subjects/41529` 返回 `airtime,collection,eps,infobox,info,metaTags,platform,rating,tags,images` 等。

**REASONING**：不能把 S3 的更丰富字段回写成 v0 contract；应按字段合并且保留 provenance。

**CONFIDENCE**：HIGH（样本 subject 41529；字段可变，具体 coverage MEDIUM）。

**ALTERNATIVES**：不同 subject 的 locked/NSFW/缺失字段可能少于样本；旧 HTML 仍可能显示 S3 schema 未暴露的区块。

**IMPLEMENTATION IMPLICATION**：`SubjectProvider` 先取 S1，按 capability 选择 S2/S3/S5；结果模型允许 field-level `missing`、`conflict` 和 `sourceEvidence[]`。

## 字段级矩阵

| 字段/能力                         | S1 v0                                          | S2 legacy                                          | S3 p1                                  | S4 embedded            | S5 HTML                | S6/S7                    |
| --------------------------------- | ---------------------------------------------- | -------------------------------------------------- | -------------------------------------- | ---------------------- | ---------------------- | ------------------------ |
| id、url、name、name_cn            | 直接                                           | Calendar item                                      | `id/name/nameCN`                       | 未发现可复用 hydration | 可见                   | S7 name normalization    |
| summary、air date、type、platform | 直接/subject detail                            | Calendar small 有基本字段                          | detail `airtime/platform/summary/type` | 未证明                 | 可见/分区              | date normalization       |
| images                            | subject/image redirect                         | `images`                                           | `images`                               | 图片 URL 可能在 style  | cover/img              | asset hash               |
| eps / episode count               | subject/episodes                               | `eps/eps_count`                                    | `eps`/episodes                         | 未证明                 | ep 列表                | main/special policy      |
| rating score/count/rank           | 直接                                           | `rating/rank`                                      | `rating`                               | 未发现                 | 可见摘要               | score bins               |
| rating histogram                  | 未覆盖为完整分布                               | 未覆盖                                             | 未在已审 p1 subject endpoint 证明      | 未发现                 | `/stats` 可见          | stddev/shape 计算        |
| collection bucket                 | subject/collection 或用户面（按 v0 operation） | `wish/collect/doing/on_hold/dropped`               | detail `collection`                    | 未证明                 | 计数/状态可见          | completion formula       |
| tags/meta tags                    | tags/search fields                             | 不稳定/非主要字段                                  | `tags/metaTags`                        | 未发现                 | tag links/count        | concept candidates       |
| infobox/aliases                   | 部分 schema/subject info                       | 不作为 small contract                              | `infobox/info`                         | 未发现                 | 页面表格               | alias normalization      |
| characters/CV                     | `/subjects/{id}/characters`                    | medium/large schema有关系字段但非 current path     | `/characters`、casts                   | 未证明                 | characters 页面        | cast dedupe/intersection |
| staff/职位                        | `/subjects/{id}/persons`                       | medium/large schema                                | `/staffs/persons/positions`            | 未证明                 | persons 页面           | role normalization       |
| relations/series                  | subject relations                              | legacy small 不足                                  | `/relations`                           | 未发现                 | relation section       | graph/order              |
| episodes/title/date/duration/type | `/episodes`                                    | legacy episode schemas                             | `/episodes`                            | 未发现                 | `/ep`                  | missing/conflict check   |
| comments/reviews/topics           | 部分 subject/community operations              | legacy topic/blog schemas但无 current general path | `/comments`,`/reviews`,`/topics`       | 未发现                 | board/comments/reviews | sampling/snapshot        |
| indexes/recs/collects             | v0 index/collection surface（按 operation）    | large schema topic/blog                            | `/indexes`,`/recs`,`/collects`         | 未发现                 | links/sections         | deterministic joins      |
| stats / completion                | 不完整                                         | 不完整                                             | 未验证 histogram                       | 未发现                 | **当前 HTML required** | S6 snapshots             |

## 代表样本

样本 `subject/41529`（《少女终末旅行》）用于 endpoint shape 观察，不是数据质量基准。建议实现前至少增加一个正在放送、一个剧场版、一个信息锁定/缺少中文名的 subject，并记录每个样本的 retrieval time 和 HTTP status。
