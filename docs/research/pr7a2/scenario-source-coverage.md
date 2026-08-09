# 103-scenario source coverage

来源分类见 [`source-taxonomy.md`](source-taxonomy.md)，原始问题见 [`../user-scenario-catalog.md`](../user-scenario-catalog.md)。下表给出每一个场景的**当前最小证据集合**和 primary coverage bucket；S7 表示本地确定性聚合/解释，不能省略输入 provenance。

## Bucket 定义与汇总

| Bucket   | 定义                                                                        |    数量 |   占 103 |
| -------- | --------------------------------------------------------------------------- | ------: | -------: |
| `API+S7` | S1/S2 原始数据足够，允许 S7 join/filter/graph；括号 `auth` 表示需要用户授权 |      76 |   73.79% |
| `S3+S7`  | 需要官方 frontend private structured read；S5 可作为显式 fallback           |      13 |   12.62% |
| `S5+S7`  | 研究时点唯一已验证的完整输入是网页 HTML（stats/分布）                       |       5 |    4.85% |
| `S6+S7`  | 必须有跨时点快照；没有兼容快照时不可计算                                    |       8 |    7.77% |
| `S8`     | 关键统计/隐私数据未验证，当前不能计算                                       |       1 |    0.97% |
| **合计** |                                                                             | **103** | **100%** |

这是“最小可行证据”分类，不是承诺所有场景现在已有 semantic tool。`S3` 仍是 INTERNAL_STRUCTURED；`S5` 不是默认静默 fallback；`S6` 缺失时必须显式返回 `not_computable`。

## Golden scenarios（G01–G30）

| ID  | Bucket        | 最小 evidence / 关键限制                                               |
| --- | ------------- | ---------------------------------------------------------------------- |
| G01 | API+S7        | S1 subject browse/search + S7 season/tag/concept；概念候选要解释       |
| G02 | API+S7        | S1 date/type/search + S7 concept/heat sort；Top 10 的 tie-break 固定   |
| G03 | API+S7        | S1 subject/rating/tag + S7 date/rating-count/original classifier       |
| G04 | API+S7        | S1 person casts + subject dates/type + S7 dedupe；缺日期保留           |
| G05 | API+S7        | S1 work graph + air dates + S7 两个窗口；不是 rating 历史增长          |
| G06 | API+S7        | S1 subject characters/actors；role semantics 和分页必须标出            |
| G07 | API+S7        | S1 subject persons + S7 position grouping；raw label 不丢              |
| G08 | S5+S7         | `/subject/{id}/stats` histogram/status distribution；没有完整 API 替代 |
| G09 | API+S7        | S1 relations + deterministic graph/order policy                        |
| G10 | S3+S7         | p1 community/trending 或 topic counts；heat 定义不是官方 v0            |
| G11 | S6+S7         | 至少两个兼容 7-day snapshots；单次 current count 不足                  |
| G12 | API+S7 (auth) | user collection + Calendar + episodes；只读当前授权 user               |
| G13 | API+S7 (auth) | collection + subject airing/eps + progress；completion rule 显式化     |
| G14 | API+S7        | S1 season/type/rating + S7 original/tie-break                          |
| G15 | S5+S7         | 基础 score/eps 可用 S1，但 completion/stats 要 S5                      |
| G16 | API+S7        | S1 person works/roles + date/type filter                               |
| G17 | API+S7        | S1 subject persons + S7 normalized positions                           |
| G18 | API+S7        | 两 subject cast sets + person identity join                            |
| G19 | API+S7        | person works + tag/infobox evidence；“原创”只做候选判断                |
| G20 | API+S7        | relation edges + date/series order policy                              |
| G21 | S6+S7         | S3/S5 topic snapshots；需要一周边界和覆盖记录                          |
| G22 | S3+S7         | community counts + S1 rating counts；来源 bias 显示                    |
| G23 | S5+S7         | stats histogram、均值/方差、样本数；HTML parser failure 不猜           |
| G24 | API+S7 (auth) | wish collection + airing status/eps classifier                         |
| G25 | API+S7 (auth) | user collection + tags/persons；只输出授权范围内聚合                   |
| G26 | API+S7        | S1 browse/search + S7 date/type/concept/rating-count                   |
| G27 | API+S7        | S1 episodes name_cn/airdate/duration，保留排序                         |
| G28 | API+S7        | S1 episode type taxonomy；special/OP/ED 语义解释                       |
| G29 | API+S7        | S1 staff graph + S7 co-credit dedupe                                   |
| G30 | S3+S7         | S3 comments/reviews/topics；只做受限样本和 provenance                  |

## DISCOVERY（D01–D07）

| ID  | Bucket | 最小 evidence / 关键限制                                            |
| --- | ------ | ------------------------------------------------------------------- |
| D01 | S6+S7  | rating_count snapshots + original classifier；没有历史返回不可计算  |
| D02 | API+S7 | S1 tags/relations + S7 candidate similarity；必须说明不是官方相似度 |
| D03 | API+S7 | S1 series graph + episodes + date/status                            |
| D04 | API+S7 | S1 eps/rating-count/tags/type                                       |
| D05 | API+S7 | S1 season/tags + S7 AND/heat；tag vocabulary可能不完整              |
| D06 | API+S7 | S1 name/name_cn completeness + type                                 |
| D07 | S6+S7  | yearly rank snapshots；固定排名定义和 cohort                        |

## COMPARISON（C01–C07）与 CONTENT（C08–C14）

| ID  | Bucket | 最小 evidence / 关键限制                                          |
| --- | ------ | ----------------------------------------------------------------- |
| C01 | API+S7 | rating/count + threshold explanation                              |
| C02 | API+S7 | series/relations + normalized subject metrics                     |
| C03 | API+S7 | person-character-subject edges + role rule                        |
| C04 | API+S7 | season cohorts + score/heat + sample-size caveat                  |
| C05 | S6+S7  | 同一人物的历史 score/rank snapshots                               |
| C06 | API+S7 | staff/person sets + weighted overlap formula                      |
| C07 | API+S7 | rating/collection bins + selection bias warning                   |
| C08 | API+S7 | subject total/episode list/current date                           |
| C09 | API+S7 | episode type taxonomy                                             |
| C10 | API+S7 | episode airdate + revision evidence where available               |
| C11 | API+S7 | names/infobox/platform/aliases                                    |
| C12 | S3+S7  | index discovery/current related membership；v0 ID 已知时可降为 S1 |
| C13 | S3+S7  | wiki recent/revision detail；schema/live mismatch需 probe         |
| C14 | API+S7 | character/person IDs + duplicate-name resolution                  |

## PERSON（P01–P07）

| ID  | Bucket | 最小 evidence / 关键限制                       |
| --- | ------ | ---------------------------------------------- |
| P01 | API+S7 | person→subject position counts                 |
| P02 | API+S7 | work dates + missing-date policy               |
| P03 | API+S7 | person works + name_cn completeness            |
| P04 | API+S7 | co-credit graph + unique subject dedupe        |
| P05 | API+S7 | subject type/platform normalization            |
| P06 | API+S7 | paginated recent works + current airing fields |
| P07 | API+S7 | tags/time bins + missing-tag bias              |

## SEIYUU（S01–S07）

| ID  | Bucket | 最小 evidence / 关键限制                          |
| --- | ------ | ------------------------------------------------- |
| S01 | API+S7 | casts + subject air dates + annual windows        |
| S02 | API+S7 | main-role classifier + score/rank tie-break       |
| S03 | API+S7 | cast intersection + series relations              |
| S04 | API+S7 | subject characters/actors + multi-role rule       |
| S05 | API+S7 | media/platform classification + excluded evidence |
| S06 | API+S7 | co-credit aggregation + count definition          |
| S07 | API+S7 | work dates/month buckets + missing-date policy    |

## STAFF（T01–T06）

| ID  | Bucket | 最小 evidence / 关键限制                                             |
| --- | ------ | -------------------------------------------------------------------- |
| T01 | API+S7 | staff relation + same-type tags                                      |
| T02 | API+S7 | role + concept/infobox evidence                                      |
| T03 | API+S7 | co-credit graph + time sequence                                      |
| T04 | API+S7 | series edges + music-role identity                                   |
| T05 | API+S7 | current work dates + role/year bins；不是 historical snapshot growth |
| T06 | API+S7 | fine-grained subject relation labels                                 |

## COMMUNITY（M01–M07）

| ID  | Bucket | 最小 evidence / 关键限制                              |
| --- | ------ | ----------------------------------------------------- |
| M01 | S3+S7  | p1/Rakuen topic activity + subject mapping            |
| M02 | S3+S7  | topic timestamps + 24h boundary；覆盖不足返回 partial |
| M03 | S6+S7  | compatible topic/reply snapshots                      |
| M04 | S3+S7  | group topics + entity extraction/provenance           |
| M05 | S3+S7  | comments/reviews counts + page coverage               |
| M06 | S3+S7  | topic/reply titles or sampled text；不把摘要当事实    |
| M07 | S3+S7  | index update metadata + quality heuristic             |

## STATISTICS（A01–A06）

| ID  | Bucket | 最小 evidence / 关键限制                                             |
| --- | ------ | -------------------------------------------------------------------- |
| A01 | S5+S7  | stats histogram + season cohort/sample size                          |
| A02 | S6+S7  | historical rank/rating snapshots；研究估计，不是平台规则             |
| A03 | API+S7 | collection buckets + completion definition                           |
| A04 | API+S7 | season cohort + eps/score + missing values                           |
| A05 | S5+S7  | score + HTML completion/status distribution                          |
| A06 | S8     | registration-year rating relationship 未验证且涉及隐私；当前不可计算 |

## COLLECTION（L01–L07）

| ID  | Bucket        | 最小 evidence / 关键限制                                   |
| --- | ------------- | ---------------------------------------------------------- |
| L01 | API+S7 (auth) | authenticated collections + S2 Calendar + episode metadata |
| L02 | API+S7 (auth) | collection state + airing/episode status                   |
| L03 | S3+S7         | p1 community counts + rating + private/public boundary     |
| L04 | API+S7        | public collection + tags                                   |
| L05 | API+S7        | collection subjects + relations                            |
| L06 | API+S7 (auth) | episode progress + totals + specials policy                |
| L07 | S3+S7 (auth)  | p1 character/person collection + subject graph             |

## PERSONAL（U01–U06）

| ID  | Bucket        | 最小 evidence / 关键限制                                   |
| --- | ------------- | ---------------------------------------------------------- |
| U01 | API+S7 (auth) | collection timestamps/air dates；若问状态变更历史则升级 S6 |
| U02 | API+S7 (auth) | ratings + staff graph                                      |
| U03 | S6+S7 (auth)  | collection transition snapshots；当前 API 没有完整历史     |
| U04 | API+S7 (auth) | relation graph + taste profile + candidates                |
| U05 | API+S7 (auth) | remaining episodes × duration + calendar                   |
| U06 | API+S7 (auth) | ratings + tags/type + selection-bias warning               |

## RELATION GRAPH（R01–R06）

| ID  | Bucket | 最小 evidence / 关键限制           |
| --- | ------ | ---------------------------------- |
| R01 | API+S7 | relation edge traversal            |
| R02 | API+S7 | graph labels/cycles                |
| R03 | API+S7 | two-hop traversal + scores         |
| R04 | API+S7 | relation type/date/order policy    |
| R05 | API+S7 | subject/person heterogeneous graph |
| R06 | API+S7 | cast graph + main-role filter      |

## Coverage interpretation

**FACT**：按上述最小证据集合，76 个场景不需要 website source 才能得到原始输入，13 个需要 S3，5 个需要 S5，8 个需要 S6，1 个当前 S8。

**EVIDENCE**：逐项映射基于 [`user-scenario-catalog.md`](../user-scenario-catalog.md)、v0/legacy schema、frontend private schema、Calendar/website/stats observations。

**REASONING**：S7 是实现层的共同依赖，故不将每个 join/过滤重复计为独立 bucket；S6/S8 是“单次当前读取不能解决”的关键差异。

**CONFIDENCE**：原始 source existence HIGH；部分 coverage 受分页、auth、时间窗口影响为 MEDIUM。

**ALTERNATIVES**：若未来 S3 提供稳定 stats，5 个 S5 场景可转为 S3；若没有快照，8 个 S6 场景必须保持 not-computable，不得降级成 current snapshot。

**IMPLEMENTATION IMPLICATION**：PR-7B 的验收应按 bucket 建立 provider contract 和 negative tests，而不是只测试 API happy path。
