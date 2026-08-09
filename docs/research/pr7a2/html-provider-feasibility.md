# HTML Provider feasibility 与最终建议

## 最终建议：保留但延后，采用 Hybrid Provider

**FACT**：S1/S2 已覆盖大部分 subject/person/episode/calendar 原始数据；S3 `/p1` 已覆盖新版网页大量 structured community/user/discovery 能力；S5 仍是 subject stats 分布和旧网页可见编排的已验证来源。

**EVIDENCE**：官方 v0/legacy schema、官方 frontend private schema/live endpoints、[`bgm.tv/subject/41529/stats`](https://bgm.tv/subject/41529/stats)、[`bgm.tv/calendar`](https://bgm.tv/calendar)。

**REASONING**：HTML Provider 不再应被设计成所有数据缺口的默认补偿层；但完全取消它会丢失 stats、旧页面可见模块和 S3 unavailable 时的有限 read fallback。最佳选择是结构化优先、HTML 隔离且 capability-scoped 的 hybrid architecture。

**CONFIDENCE**：HIGH（“需要隔离”）；具体 stats DOM parser 成本 MEDIUM。

**ALTERNATIVES**：只做 official API 是最稳定但能力不足；直接依赖 p1 成本较低但 private contract risk 高；纯 HTML 覆盖广但 parser/条款/质量风险最高。

**IMPLEMENTATION IMPLICATION**：PR-7B 不实施 HTML Provider。未来分层：`OfficialApiProvider`（S1/S2）→ `StructuredWebProvider`（S3，feature flag）→ `HtmlProvider`（S5，allowlist）→ `SnapshotProvider`（S6）→ `DerivedAnalyticsProvider`（S7）。每层独立 health、rate、cache、provenance。

## HTML-required capability list（研究时点）

| Capability                                  | 为何 HTML required               | S3 未来变化时的替代                     |
| ------------------------------------------- | -------------------------------- | --------------------------------------- |
| 完整 rating histogram / status distribution | 未在 S1/S2/S3 已审 contract 证明 | 若官方提供 stats endpoint，优先 S3      |
| old subject stats page 的可见定义/分母文案  | 页面定义是 S5 证据               | 保留 S5 作为 evidence，即使数据另有 API |
| 旧 Rakuen/board 页面编排与未映射链接        | S3 coverage 不保证完整           | S3 subject/group topics + S5 fallback   |
| 页面 only 的 discovery controls/排序显示    | S1/s3 filter vocabulary 可能不同 | capability diff 后再结构化              |

## 不该用 HTML 的能力

Calendar、subject detail、episodes、cast/staff、person works、public collections 和基础关系已有 S1/S2 或 S3；HTML 只能作为可见性验证/有限 fallback，不能在 API 失败时静默抓取并改变语义。

## Parser/运营要求（设计，不实施）

- URL allowlist + method GET only + identifying UA + response byte limit。
- 页面 fingerprint、parser version、DOM selector contract test；结构变化即停，不输出猜测。
- 429/403/5xx/schema mismatch 触发 circuit breaker；不绕过登录、验证码、robots 或权限。
- 默认保留 metadata/URL/count/time，不保存公开正文全文；删除/隐私与条款需单独 review。
- HTML result 必须有 `sourceUrl`, `retrievedAt`, `coverage`, `parserVersion`, `stale` 和 confidence。
- HTML 失败不阻塞 official query；失败原因要回传给 capability result。
