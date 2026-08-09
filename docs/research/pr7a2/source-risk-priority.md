# Source risk / priority

评分 1–5：User Value 越高越重要；Stability 越高越稳定；Cost/Legal/Operational Risk 越高越危险。它们是研究决策分数，不是精确财务/法律结论。

| Capability                            | User Value | Source stability | Impl cost | Legal risk | Ops risk | Freshness sensitivity | Priority                 |
| ------------------------------------- | ---------: | ---------------: | --------: | ---------: | -------: | --------------------- | ------------------------ |
| v0 subject search/browse/detail       |          5 |                5 |         2 |          1 |        2 | medium                | NOW                      |
| v0 cast/staff/episodes/relations      |          5 |                5 |         3 |          1 |        2 | low–medium            | NOW                      |
| legacy Calendar + v0 hydration        |          5 |                4 |         2 |          1 |        2 | high near airing      | NOW                      |
| authenticated collection/progress     |          5 |                4 |         4 |          2 |        3 | high/private          | NOW                      |
| S7 query planner/concept evidence     |          5 |                4 |         4 |          1 |        3 | medium                | NOW                      |
| S7 person workload/co-credit          |          4 |                4 |         4 |          1 |        3 | medium                | NEXT                     |
| S3 structured subject/community reads |          4 |                2 |         3 |          3 |        3 | high                  | NEXT (gated)             |
| S6 snapshots/trend                    |          4 |                3 |         4 |          2 |        4 | high                  | NEXT                     |
| core subject stats (S1 + S7)          |          4 |                5 |         3 |          1 |        2 | medium                | NOW                      |
| S5 web-specific stats                 |          3 |                2 |         4 |          3 |        4 | medium                | LATER (isolated)         |
| S3 public user activity               |          3 |                2 |         4 |          4 |        4 | high/private          | LATER                    |
| S3 groups/blogs/social graph          |          3 |                2 |         4 |          5 |        4 | high/private          | LATER                    |
| HTML Rakuen full-site crawl           |          3 |                1 |         5 |          5 |        5 | high                  | AVOID as default         |
| community body-text summarization     |          3 |                2 |         5 |          5 |        5 | high                  | AVOID until terms review |
| historical rank/demographic inference |          2 |                1 |         5 |          4 |        4 | high                  | AVOID/NOT_COMPUTABLE     |

## Priority rationale

**FACT**：官方 v0 是 55 operations 的稳定 schema；S2 Calendar 当前只有 1 operation；S1 Subject 已直接提供 rating histogram 与 collection buckets，S3 是官方 frontend private API；S5 web-specific stats/community 页面可见但 DOM/terms 风险更高；S6 需要 AgentKit 自己持续保存。

**EVIDENCE**：[`official-api-family-map.md`](official-api-family-map.md)、[`structured-web-endpoints.md`](structured-web-endpoints.md)、[`html-provider-feasibility.md`](html-provider-feasibility.md) 及对应官方链接。

**REASONING**：基础 catalog 的价值和稳定性最高，优先把 S1/S2/S7 做成可验证语义；S3/S5/S6 是能力扩展，应有 feature gate、circuit breaker 和 evidence state；无法合法/稳定证明的统计不应为了覆盖率上线。

**CONFIDENCE**：NOW/NEXT 的相对顺序 HIGH；法律分数仅是工程风险信号，不能替代法律意见。

**ALTERNATIVES**：如果官方为 p1 提供公开 versioning/terms，S3 可前移；如果 stats endpoint 出现，S5 可后移。

**IMPLEMENTATION IMPLICATION**：路线图应以 capability contract 和 evidence model 为先，而不是以“能抓多少网页”为完成标准。
