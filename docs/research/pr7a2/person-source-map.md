# Person / seiyuu / staff source map

## 分类结论

**FACT**：S1 v0 已提供 person detail、person→works/casts/relations 等官方关系面；S3 `/p1/persons/{id}` 及 `/works`、`/casts`、`/comments` 提供新版网页使用的更细角色/职位分页；S5 person 页面补充网页编排和可见 collaboration 区块。

**EVIDENCE**：v0 [`open-api/v0.yaml`](https://raw.githubusercontent.com/bangumi/api/master/open-api/v0.yaml)；官方 private schema [`frontend/packages/client/api.yaml`](https://github.com/bangumi/frontend/blob/master/packages/client/api.yaml)；live sample `/p1/persons/10868`（水濑祈）及 works/casts endpoints；网页 [`bgm.tv/person/10868`](https://bgm.tv/person/10868)。

**REASONING**：person identity 与原始 credits 优先 S1；需要按职位/媒介/角色筛选时 S3 能降低多跳成本，但不能把 S3 role labels 当成 v0 语义；workload、合作网络是 S7 聚合，时间趋势还需要 S6。

**CONFIDENCE**：S1/S3 existence HIGH；职位归一化和完整 coverage MEDIUM。

**ALTERNATIVES**：同一人物可同时有 CV、staff、音乐/制作 credit；不同页面可能用不同中文名/职业字段。没有 identity evidence 时不能按显示名合并。

**IMPLEMENTATION IMPLICATION**：PersonProvider 返回 raw credit edges + normalized role candidates，不直接返回“导演/声优”单一标签；Renderer 显示角色范围、媒介过滤、日期 coverage 和 unresolved edges。

## 字段与来源

| 能力                                 | S1                                | S3                                                  | S5                   | S6/S7                      |
| ------------------------------------ | --------------------------------- | --------------------------------------------------- | -------------------- | -------------------------- |
| identity/name/name_cn/avatar/infobox | person detail                     | person detail 更丰富 info/career/images             | 页面 header/sections | alias identity evidence    |
| CV / cast role                       | person casts / subject characters | `/persons/{id}/casts`、subject characters role/type | 角色 tab             | role normalization、dedupe |
| staff position                       | person works / subject persons    | `/works?position`、`/staffs/positions`              | 职位分组             | position taxonomy          |
| work list / dates / media            | person subjects/relations         | `/works?subjectType`                                | recent/career 页面   | TV-only/window/dedup       |
| collaboration                        | raw relations and shared subjects | relations + casts/works                             | 可能有页面编排       | co-credit graph            |
| comments/collects                    | 部分 official collection surface  | `/comments`, `/collects`                            | person page入口      | 计数/时间 snapshot         |
| workload                             | 原始 edge 可取得但无聚合          | filters reduce fetch                                | 页面非稳定报表       | monthly/6m/12m aggregation |

## 典型用户问题的 source decision

| 问题 | 最小 source set | 限制 |
| 水濑祈近 12 月 TV 配音数量 | S1 person-casts + S1 subject detail + S7 | 日期缺失/重复角色必须显式处理；S6 仅在问增长时需要 |
| 两部作品共同声优 | S1 subject characters + person id join + S7 | `main/support` role 的归一化不是官方统一结论 |
| 某导演近三年 TV 作品 | S1 person works + S7 | role/媒介需可解释 filter；S3 可加速但非必要 |
| 作品制作人员职位分组 | S1 persons + S7 或 S3 positions | raw labels 保留，未知职位不丢弃 |
| 合作次数 Top 3 | S1 edges + S7 | 需要 unique subject/role scope；不能把同作品多角色不加说明地计多次 |

## S3 shape warning

live `/p1/persons/10868/comments` 曾返回 raw JSON array，而相邻 endpoint 使用 `{data,total}`。这不是数据缺失证明，而是 parser contract drift 样本。PersonProvider 必须用 endpoint-specific schema、失败隔离和 contract probe。
