# PR-7A 产品路线图建议

> 当前冻结基线：`85d1c85ad367d4ce8f8f605ffafc18cfeb089f92`。本文只给出 PR-7A 研究后的顺序、边界和验收条件；不启动 PR-7B，也不改变当前生产代码。

## 价值排序方法

每项用 1–5 评分：

- User Value：能解决多少高频/高价值用户问题。
- Data Availability：官方 API/稳定公开数据是否已存在。
- Implementation Cost：5 = 成本低，1 = 成本高；评分越高越优先。
- Reliability：来源、口径和长期可维护性。
- Agent Leverage：自然语言 Agent 是否能明显优于手工网页操作。

总序按 user value、data/reliability、agent leverage 优先，cost 用于同级 tie-break；不是财务 ROI。

## PR-7B → PR-7F 路线

| 阶段                                       | 目标                                                | 范围                                                                                                                                                                                        | 明确不做                                                  | 依赖                                                                    | Exit criteria                                                                                   |
| ------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| PR-7B Advanced Discovery                   | 把“找作品”从 keyword 提升为可解释 typed query       | `SubjectQuery`、日期/评分/评分人数/rank、tag/meta_tag AND/NOT、type/media、browse/season、排序/tie-break、ConceptResolver、evidence envelope、SearchResults/SeasonRanking                   | 社区 HTML、个人画像、推荐模型、写入扩展                   | 固定 v0 API、查询模型、分页/缓存策略                                    | golden G01–G03/G14/G26 可复现；exact/ambiguous concept 测试；JSON/MCP/PNG 口径一致              |
| PR-7C Person/Staff/Relationship            | 把人物、声优、制作人员和系列关系变成可查询图        | subject staff semantic、person work graph、cast role normalization、VoiceActorWorkload、StaffActivity、series relation graph/watch order、Cast/Staff/PersonProfile/PersonWorkload/Relations | 社区趋势、个性化推荐、站外履历补全                        | v0 person/character/subject relationships、air date、role evidence      | G04–G07/G09/G16/G18–G20；3/6/12 月口径、TV-only、主/配角和 unresolved rows 明确                 |
| PR-7D Renderer 2.0                         | 让查询/分析结果在 JSON 之外可读、可审计、适配移动端 | 12 view catalog、responsive view models、evidence/confidence/freshness badges、长标题/多角色/无图状态、修复后封面回归                                                                       | 新数据 provider、业务语义猜测、版权资产复制               | Query/Analytics result schema、AssetResolver 修复、renderer self-tests  | 全部模板在窄宽度/长 CJK/partial/stale/auth 状态下可读；截图 golden diff；无 secret/private 泄漏 |
| PR-7E Community/HTML                       | 以受控 provider 补充讨论和社区情报                  | Rakuen/board/comments/reviews/groups allowlist、短 TTL、parser version、snapshot、CommunityTrending/CommunityTrend、计数级摘要                                                              | 全站无界爬取、绕过登录/验证码、默认全文复制、把热度当质量 | 条款/robots 审查、速率、缓存、identity mapping、not-computable contract | G10–G12/G21–G23/M01–M07；单快照不算增长；provider failure 不影响 official API                   |
| PR-7F Personal Analytics & Recommendations | 从当前用户授权数据生成可解释的计划和偏好视图        | authenticated episode collection read、CollectionBacklog、weekly schedule、UserTasteProfile、系列 backlog、可解释 candidate recommendations                                                 | 敏感画像、跨用户私有缓存、黑箱推荐、自动写入              | OAuth/account boundary、calendar/episode join、private cache isolation  | G12–G13/G24–G25/L01–L07/U01–U06；权限/撤销/过期测试；所有推荐有证据和排除理由                   |

## 推荐首批能力评分

| 能力                             | User Value | Data Availability | Implementation Cost | Reliability | Agent Leverage | 推荐阶段                   |
| -------------------------------- | ---------: | ----------------: | ------------------: | ----------: | -------------: | -------------------------- |
| Subject advanced filters         |          5 |                 5 |                   5 |           5 |              5 | 7B-1                       |
| Season/browse query              |          5 |                 5 |                   5 |           4 |              5 | 7B-2                       |
| ConceptResolver                  |          5 |                 4 |                   4 |           4 |              5 | 7B-3                       |
| Series watch order               |          5 |                 5 |                   4 |           4 |              5 | 7C-1                       |
| Subject cast/staff semantic      |          5 |                 5 |                   4 |           4 |              5 | 7C-2                       |
| VoiceActorWorkload               |          5 |                 4 |                   4 |           4 |              5 | 7C-3                       |
| Renderer evidence/partial states |          4 |                 5 |                   3 |           4 |              5 | 7D-1                       |
| Mobile search/deep views         |          4 |                 5 |                   3 |           4 |              4 | 7D-2                       |
| Subject stats distribution       |          5 |                 3 |                   3 |           3 |              4 | 7D/7E gate                 |
| Community current ranking        |          5 |                 2 |                   3 |           2 |              4 | 7E-1                       |
| Community 7-day trend            |          5 |                 2 |                   2 |           2 |              4 | 7E-2, only with snapshots  |
| Authenticated backlog            |          5 |                 4 |                   4 |           4 |              5 | 7F-1                       |
| User taste profile               |          4 |                 4 |                   3 |           3 |              4 | 7F-2                       |
| Recommendations                  |          4 |                 3 |                   2 |           3 |              5 | 7F-3, after evidence layer |

## 产品风险与闸门

### 数据口径闸门

- 不把 `search sort=heat` 重新命名为“过去 7 日热度”，除非有官方定义或自有快照公式。
- 不把 `Subject.rating/collection` 当成完整的评分分布或完成率。
- 不把 person→subjects 的关系行数当成声优工作量；必须去重并报告角色/媒介/日期覆盖。
- 不把“原创”“异世界”“后宫”等自然语言概念静默映射成一个标签。

### 数据源闸门

- official API 优先；HTML 只在产品确实需要且经过 provider/条款审查时开启。
- 单次 HTML 页面不能回答 growth/velocity；必须有历史快照。
- source、retrievedAt、cacheState、parserVersion、coverage 和 confidence 必须进入结果 contract。

### 隐私与安全闸门

- private collection、episode progress、OAuth material 不进入共享缓存、日志和截图。
- 社区用户名/正文默认最小化；删除/隐私状态要能让缓存失效。
- 图片 provider 维持 SSRF、content-type、大小和 redirect 防护；失败诊断不能暴露内部网络细节。

### 产品表达闸门

- JSON、MCP、Standalone 和 PNG 对同一 query 必须保持同一过滤、排序、数量和证据。
- Renderer 必须可表达 empty/partial/stale/auth_required/not_computable，而不是用空数组掩盖失败。
- 移动端和 CJK 长文本用真实 golden fixtures 验证；不以桌面截图通过代替可用性。

## 建议版本节奏

```text
7A 研究冻结
  → 7B typed discovery + evidence
  → 7C person/staff/relationship graph
  → 7D Renderer 2.0 + asset regression
  → 7E opt-in community provider + snapshots
  → 7F authenticated personal analytics
```

每阶段都应先补 golden scenarios 与 source matrix，再提交代码；若某阶段的 required source 仍为 `not_computable`，应缩小产品承诺而不是用 heuristic 填充空白。

## 参考交付物

- [能力缺口矩阵](bangumi-capability-gap.md)
- [Query Model](query-model-design.md)
- [Analytics 设计](analytics-design.md)
- [社区数据研究](community-data-research.md)
- [Renderer 产品审计](renderer-product-audit.md)
- [数据源矩阵](data-source-matrix.md)
