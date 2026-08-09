# Source fallback / merge / evidence design

## 目标

Fallback 是 capability-specific 的可解释策略，不是“任意来源都能补字段”。Provider 只能返回其 source class、原始值、时间和 coverage；merge 层按字段策略生成产品结果。

## 建议层级

```text
OfficialApiProvider (S1 v0, S2 legacy)
        ↓ missing capability only
StructuredWebProvider (S3, feature-flagged/internal)
        ↓ missing page-visible capability only
HtmlProvider (S5, allowlist)
        ↓ persist observations, never fabricate history
SnapshotProvider (S6)
        ↓ deterministic joins / formulas
DerivedAnalyticsProvider (S7)
```

S4 embedded data只在页面确实携带实体数据时使用，通常作为 S3/S5 adapter 内部实现，不单独成为无证据 fallback。

## Capability fallback table

| Capability                        | Primary            | Fallback                              | 禁止的 fallback                           |
| --------------------------------- | ------------------ | ------------------------------------- | ----------------------------------------- |
| Calendar days/items               | S2                 | S3 experimental → S5 display evidence | 把 S5 headline 当 item truth；把 p1 当 v0 |
| Subject core                      | S1                 | S3 → S5                               | 用旧 HTML 结果覆盖新鲜 S1 字段            |
| Stats histogram                   | S5                 | future S3/S1 capability               | 用 score/count 推导 histogram             |
| Cast/staff/relations/episodes     | S1                 | S3 → S5                               | 以页面缺一行推断不存在                    |
| Community current                 | S3                 | S5                                    | 用 S1 subject count 伪装 community heat   |
| Community growth                  | S6 over S3/S5      | none → `NOT_COMPUTABLE`               | 用一次 current count 计算 7-day delta     |
| User private collection/progress  | S1 auth or S3 auth | none                                  | public HTML / another user data           |
| Public profile/activity           | S1                 | S3 → S5                               | 未授权时读取 private-looking fields       |
| Historical rank/rating/collection | S6                 | source-specific archived snapshots    | 用当前 rank 回填过去                      |

## Merge rules

1. **Identity first**：只按 stable id 合并；名称/URL 只能生成 unresolved candidate，不足以覆盖 id。
2. **Official precedence**：同一字段同一 observation window 下，S1/S2 的 contract field 优先 S3/S5；保留冲突 evidence。
3. **Narrow scope**：S2 Calendar `collection.doing` 与 S3 `watchers` 不是同一字段，不合并为一个 `watchers`。
4. **No empty overwrite**：后来源的 `null`/缺失不能覆盖前来源的非空值；source 明确表示 empty 时另记 `knownEmpty`。
5. **Freshness aware**：旧的 S1 不能无条件覆盖较新的 S3；选择由 field policy 决定，冲突同时展示 retrievedAt。
6. **Derived isolation**：S7 输出必须引用所有输入 evidence 和 formula version；不能把派生值写回原始 source object。
7. **Auth isolation**：带 user auth 的字段永不进入 anonymous/public cache；跨用户 merge 禁止。

## 失败与产品状态

| 状态             | 含义                                | Renderer 文案                   |
| ---------------- | ----------------------------------- | ------------------------------- |
| `complete`       | 所需字段和分页覆盖达到定义          | “完整（source/as-of）”          |
| `partial`        | 某 source/分页/字段缺失，但仍可回答 | “部分数据，缺少 …”              |
| `stale`          | 有上次成功结果但超过 TTL            | “缓存截至 …”                    |
| `not_computable` | 缺历史、auth 或必要字段             | “当前证据不足，无法计算”        |
| `conflict`       | 两来源相同语义值不一致              | 显示双方值和 source，不强行裁决 |
| `unavailable`    | provider 被 circuit breaker 停用    | “来源暂不可用”                  |

## Evidence envelope 设计检查

每个回答至少带：`sourceClass`, `provider`, `sourceUrl`, `retrievedAt`, `observedAt`, `authScope`, `freshness`, `coverage`, `confidence`。S3/S5 还必须带 `parserOrSchemaVersion`；S6 带 snapshot id/interval；S7 带 formula version 和 input ids。
