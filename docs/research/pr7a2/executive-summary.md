# PR-7A2 executive summary

## Scope and answer

本轮严格基于 `9fc2d3dc2aedf40a9a2bc64f0e31577c52ddbe98` 做 read-only research：没有修改生产 runtime、API/MCP 架构、数据库、auth 或 Renderer 实现，也没有实施 PR-7B。

核心结论是 **Hybrid Bangumi Product Provider**：

```text
S1 Official v0 + S2 Official legacy
        → S7 deterministic joins/analytics
        → S3 official frontend private structured (gated)
        → S5 HTML (allowlist, isolated)
        → S6 AgentKit snapshots for history
```

## 最重要的事实

1. **官方 operation families**：当前 v0 为 **55**；当前 official legacy 为 **1**（`GET /calendar`）；官方文档 family 合计 **56**；历史 legacy 峰值为 **14**。详见 [`official-api-family-map.md`](official-api-family-map.md) 和 [`legacy-api-audit.md`](legacy-api-audit.md)。
2. **Calendar**：v0 没有等价 operation；S2 `/calendar` 是 canonical calendar collection，推荐 `LEGACY_PLUS_V0_HYDRATION`。网页 headline、可见条目数和 p1 watchers 可能出现同日差异，不能无 provenance 合并。详见 [`calendar-deep-dive.md`](calendar-deep-dive.md)。
3. **Website structured**：官方 frontend private schema/live `/p1/openapi.json` 观察到 **155 paths / 201 operations**。这是真实内部结构化数据面，不是公共 v0 contract。详见 [`structured-web-endpoints.md`](structured-web-endpoints.md)。
4. **Community**：没有完整 S1/S2 community contract，但 S3 已覆盖 topics/comments/reviews/groups/trending；S5 是 fallback，S6 是增长问题的必要历史输入。详见 [`community-source-map.md`](community-source-map.md)。
5. **Stats**：S1 Subject 直接提供 rating histogram 与五类 collection buckets；completion 和 population SD 由 S7 从 S1 计算，五个网站样本均复现到显示精度。S5 只保留网站特有交叉/用户分布/VIB/放送图表与定义文案。详见 [`subject-source-map.md`](subject-source-map.md) 和 [`html-provider-feasibility.md`](html-provider-feasibility.md)。
6. **103 scenarios**：`API+S7` 81、`S3+S7` 13、`S5+S7` 0、`S6+S7` 8、`S8` 1；每个 ID 已逐项列出。详见 [`scenario-source-coverage.md`](scenario-source-coverage.md)。
7. **Renderer**：所有 view model 需要统一 evidence/state/freshness/coverage/auth/formula envelope；Stats、CommunityTrending、PersonWorkload、CollectionDashboard 不能只接受普通字段。详见 [`renderer-data-requirements.md`](renderer-data-requirements.md)。

## Source-of-truth policy

- S1/S2 是默认公共数据合同。
- S3 使用 `INTERNAL_STRUCTURED` policy label；只允许显式、只读、可撤销的 feature-gated provider。
- S5 使用 allowlist parser，失败即停止，不通过 selector 猜测。
- S6 只由 AgentKit 自己保存固定 query/source/parser 的 snapshots；没有 snapshots 不计算变化。
- S7 所有聚合公开输入、公式、窗口、去重和缺失策略。
- S8 只能返回证据不足，不能借助另一个页面假装完成。

## Deliverables

本目录包含 PR-7A2 要求的 20 份研究文档，以及本次纠偏的独立 [stats-source-correction-research.md](stats-source-correction-research.md) 证据笔记；`official-api-family-map.md` 由独立官方 family audit 生成并已复核。所有重大判断遵循 FACT / EVIDENCE / REASONING / CONFIDENCE / ALTERNATIVES / IMPLEMENTATION IMPLICATION 口径。
