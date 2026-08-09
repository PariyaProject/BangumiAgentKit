# HTML Provider feasibility 与最终建议

## 最终建议：保留但延后，采用 Hybrid Provider

**FACT**：S1/S2 已覆盖大部分 subject/person/episode/calendar 原始数据；S1 Subject 还直接提供总体 rating histogram 与五类 collection buckets；S3 `/p1` 已覆盖新版网页大量 structured community/user/discovery 能力；S5 仍提供网站特有 stats chart、定义文案和旧网页可见编排。

**EVIDENCE**：官方 v0/legacy schema、官方 frontend private schema/live endpoints、[`bgm.tv/subject/41529/stats`](https://bgm.tv/subject/41529/stats)、[`bgm.tv/calendar`](https://bgm.tv/calendar)。

**REASONING**：HTML Provider 不再应被设计成 rating histogram、基础 collection distribution 或 core completion/SD 的默认补偿层；但完全取消它会丢失网站特有 chart、stats 定义、旧页面可见模块和 S3 unavailable 时的有限 read fallback。最佳选择是结构化优先、HTML 隔离且 capability-scoped 的 hybrid architecture。

**CONFIDENCE**：HIGH（“需要隔离”）；具体 stats DOM parser 成本 MEDIUM。

**ALTERNATIVES**：只做 official API 是最稳定但能力不足；直接依赖 p1 成本较低但 private contract risk 高；纯 HTML 覆盖广但 parser/条款/质量风险最高。

**IMPLEMENTATION IMPLICATION**：PR-7B 不实施 HTML Provider。未来分层：`OfficialApiProvider`（S1/S2）→ `StructuredWebProvider`（S3，feature flag）→ `HtmlProvider`（S5，allowlist）→ `SnapshotProvider`（S6）→ `DerivedAnalyticsProvider`（S7）。每层独立 health、rate、cache、provenance。

## HTML-required capability list（研究时点）

| Capability                                             | 为何仍是 S4/S5 web-specific                                      | S3 未来变化时的替代                   |
| ------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------- |
| rating by collection type (`interest_type`)            | S1 只有总体 histogram，没有 user collection state × score 交叉表 | 若 p1 提供稳定交叉表，优先 S3         |
| user collection-volume distribution (`total_collects`) | 需要用户总体收藏量分桶，Subject schema 不含                      | 若 p1 提供公开聚合，优先 S3           |
| user registration-time distribution (`regdate`)        | 需要用户注册时间分桶，Subject schema 不含                        | 若 p1 提供公开聚合，优先 S3           |
| rating time since registration (`relative_regdate`)    | 需要用户注册时间与评分时间关系                                   | 若 p1 提供稳定公开聚合，优先 S3       |
| VIB rating distribution                                | VIB 是网站特定用户筛选/定义，不在 S1                             | 只有官方结构化定义和数据出现后才替代  |
| broadcast-time distribution (`airdate`)                | 是 rating × airdate status 的网站图表，不是 Calendar 基础字段    | p1 若公开同一聚合再评估               |
| stats-page explanatory definitions / Beta labels       | 这是网站定义/展示 provenance                                     | 保留 S5 作为 definition evidence      |
| 旧 Rakuen/board 页面编排与未映射链接                   | S3 coverage 不保证完整                                           | S3 subject/group topics + S5 fallback |

## 不该用 HTML 的能力

Calendar、subject detail、episodes、cast/staff、person works、public collections、基础关系、总体 rating histogram、collection buckets、completion 和 population SD 已有 S1/S2 + S7 支撑；HTML 只能作为 web-specific stats、可见性验证和有限 fallback，不能在 API 失败时静默抓取并改变语义。

## v0.1 / v0.2 importance

**结论**：HTML 对高价值 v0.1 core capabilities 不是必要条件；对 v0.2 主要是 advanced stats、community fallback、旧站页面证据和 website-specific definitions 的可选增强。若产品承诺显示 `interest_type`、用户收藏量/注册时间/评分时间分布、VIB 或 broadcast-time chart，则仍需 S5 或未来获得等价的 S3 source；若只承诺 core Subject Stats，S1+S7 已足够。

## Parser/运营要求（设计，不实施）

- URL allowlist + method GET only + identifying UA + response byte limit。
- 页面 fingerprint、parser version、DOM selector contract test；结构变化即停，不输出猜测。
- 429/403/5xx/schema mismatch 触发 circuit breaker；不绕过登录、验证码、robots 或权限。
- 默认保留 metadata/URL/count/time，不保存公开正文全文；删除/隐私与条款需单独 review。
- HTML result 必须有 `sourceUrl`, `retrievedAt`, `coverage`, `parserVersion`, `stale` 和 confidence。
- HTML 失败不阻塞 official query；失败原因要回传给 capability result。
