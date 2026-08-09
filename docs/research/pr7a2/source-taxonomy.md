# PR-7A2 来源分类与证据口径

> Base: `9fc2d3dc2aedf40a9a2bc64f0e31577c52ddbe98`。本文件定义本轮研究中所有来源的名称、可信边界和写入 Provider 设计的规则。它不是运行时实现。

## 1. 八类来源

| 类别 | 名称                 | 具体例子                                                            | 能证明什么                                                 | 不能证明什么                                                                |
| ---- | -------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| S1   | Official v0          | `https://api.bgm.tv/v0/*`，仓库固定 `openapi/upstream/v0.yaml`      | 有版本化 OpenAPI 语义、请求/响应及公开读能力               | 不覆盖旧 `/calendar`、网页展示顺序或社区全文                                |
| S2   | Official legacy      | `GET https://api.bgm.tv/calendar` 及历史 `open-api/api.yml` 路径    | 仍在官方 API 文档和服务器上保留的 legacy 能力              | 不因为路径可访问就自动成为当前推荐 API；历史已删除路径不能回填              |
| S3   | Website structured   | `GET https://next.bgm.tv/p1/*`，官方 frontend 的私有 OpenAPI/client | 官方网页当前使用的结构化数据面；可观察到的 public GET 行为 | 不是 `bangumi.github.io/api` 的公共合约；不能推定长期兼容、无认证或可再分发 |
| S4   | Website embedded     | HTML 内 JSON、JSON-LD、hydration state、data attributes             | 页面将哪些数据嵌入客户端/文档                              | 没有嵌入就不能假设页面有可复用 JSON；不应把导航配置当实体事实               |
| S5   | Website HTML         | `https://bgm.tv/calendar`、subject/stats、Rakuen 等服务端页面       | 页面实际可见字段、链接和展示规则                           | 不保证隐藏分页、稳定 DOM、完整数据覆盖或结构化 API 语义                     |
| S6   | Derived snapshots    | AgentKit 自己按固定规则保存的时点快照                               | 可重复计算增长、历史排名、变化检测                         | 单次当前响应不能伪装成历史事件；快照缺失时必须返回不可计算                  |
| S7   | Derived relational   | 从 S1–S6 确定性 join、去重、图遍历、统计                            | 计算出的系列顺序、共同作品、窗口聚合等，并可复现公式       | 不是 Bangumi 原始字段；必须公开输入集、公式和缺失策略                       |
| S8   | Unknown / unverified | 未抓取、不可验证、需要登录但无授权、来源归属不明                    | 只能记录为研究缺口                                         | 不能作为答案、默认 fallback 或“官方支持”声明                                |

## 2. 关键术语

- **PUBLIC_V0**：只指 S1，且只使用 `v0.yaml` 中声明的 operation。不能因为网站或 `/p1` 有同名功能而扩展这个标签。
- **PUBLIC_LEGACY**：只指 S2 当前仍出现在官方 legacy `api.yml` 且可验证的 operation。历史文件中删除的操作标为 `HISTORICAL_ONLY`。
- **INTERNAL_STRUCTURED**：S3 的政策标签。即使无 cookie 的 GET 当前返回 200，也不能把它升级成 PUBLIC API；本研究同时记录实际观察到的 `WEBSITE_STRUCTURED_PUBLIC` 行为。
- **HTML_REQUIRED**：在研究时点没有 S1/S2/S3/S4 能稳定提供所需字段，且页面可见 HTML 是唯一已验证面。它不是“永远只能 HTML”。
- **NOT_COMPUTABLE**：输入数据、历史快照或授权范围不足；这是产品结果状态，不是一个 Provider。

## 3. 证据等级

| 等级 | 证据                                                        | 适用边界                                 |
| ---- | ----------------------------------------------------------- | ---------------------------------------- |
| E1   | 官方仓库当前 schema / 官方文档 / 可重复的官方 endpoint 响应 | 可作为 source contract；仍需记录检索时间 |
| E2   | 官方 frontend 源码、生成的 private OpenAPI、官方网页结构    | 可证明网页实现和当前形态，不等同公共 SLA |
| E3   | 同一时点的 HTML + structured/API 差异采样                   | 可证明显示差异，不能推出全站长期规律     |
| E4   | AgentKit 的 deterministic join / snapshot                   | 可用于派生结果，必须带公式和输入来源     |
| E5   | 单次失败、页面文案、未验证推测                              | 只能作为风险/待验证项                    |

## 4. 每个重大结论的最小记录

本目录其余文档的重大判断均采用以下六段：

1. **FACT**：观察到的事实，不夹带推断。
2. **EVIDENCE**：URL、仓库路径、schema 字段或观测日期。
3. **REASONING**：从事实到分类/推荐的推理。
4. **CONFIDENCE**：`HIGH`、`MEDIUM` 或 `LOW`，说明为何。
5. **ALTERNATIVES**：仍可能成立的解释或替代来源。
6. **IMPLEMENTATION IMPLICATION**：未来 Provider/Renderer 应如何处理。

所有时间敏感观察均使用 `2026-08-09` 研究时间，并在实现中重新获取；不是固定 fixture。

## 5. 统一 provenance envelope（设计提案）

未来结果应携带类似以下元数据；此处只定义研究口径，不添加代码：

```ts
type Evidence = {
  sourceClass: 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7';
  provider: string;
  sourceUrl: string;
  observedAt: string;
  retrievedAt: string;
  parserOrSchemaVersion?: string;
  authScope: 'none' | 'public' | 'user' | 'unknown';
  freshness: 'fresh' | 'stale' | 'unknown';
  coverage: 'complete' | 'partial' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
};
```

S7 结果必须同时列出 `inputs` 和 `formulaVersion`；S6 结果必须列出快照间隔；S3/S5 必须列出 parser/schema 版本。任何 S8 结果只能产生缺口说明。
