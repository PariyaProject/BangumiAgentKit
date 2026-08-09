# Renderer 产品审计与 Renderer 2.0 目录

> PR-7A 研究交付物。审计基于当前 `packages/renderer` 的五个模板、view-model builders、AssetResolver/RenderService；不实施 UI 重构。

## 当前渲染链路

```text
semantic tool / service
  → view-model builder
  → TemplateRegistry（5 templates）
  → AssetResolver（HTTP image → Sharp → data URL）
  → React server/static markup
  → Playwright Chromium screenshot
```

当前注册模板：

1. `SubjectCard`
2. `SearchListCard`
3. `CastCard`
4. `CollectionProgressCard`
5. `CalendarCard`

当前模板的共同优点是输出尺寸可控、字段来源明确、能在无图时显示占位符；共同缺点是 view model 只承载展示字段，不承载 query explanation、evidence、freshness、confidence、partial coverage 和可计算失败原因。

## 当前模板逐项审计

| 模板                   | 当前内容                                                              | 能回答的问题                         | QQ / 缺口                                                                     | 移动端问题                                                                   | 产品判断                                            |
| ---------------------- | --------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------- |
| SubjectCard            | 左封面、标题/中文名、日期/集数/平台、评分、标签、简介、收藏状态、页脚 | “这是什么”“评分/题材/基本信息是什么” | 不显示原始来源、关系、统计分布、缺字段原因；长简介吞噬层级                    | 160×220 封面和横向布局在窄屏挤压标题；中日韩长名、多别名、无图状态不够层次化 | 适合作为列表摘要，不适合 deep dive                  |
| SearchListCard         | 搜索命中条目、较小图片、标题和核心 meta                               | “搜索结果有哪些”                     | 当前 search 语义本身缺高级过滤；无 query explanation、排序定义、总数/页码证据 | 多行标题与 meta 容易变成密集文本；小图裁切不统一                             | 应成为 SearchResults 的 row/card 子组件             |
| CastCard               | 角色网格、角色图、角色名、CV/演员图                                   | “谁演了谁”                           | main/support、role evidence、重复 CV、完整/部分覆盖没有表达                   | 多角色 grid 在窄宽度折行；中文/日文姓名和 CV 过长                            | 应被 Cast/Staff 深视图复用                          |
| CollectionProgressCard | 作品、状态、进度/总集数、进度条                                       | “我看到哪里”“收藏状态如何”           | authenticated/private、剩余集数口径、未播/特别篇、更新时间和数据缺失未表达    | 进度条和状态 badge 易占满卡片，长标题折叠规则不足                            | 应成为 CollectionDashboard 的 item                  |
| CalendarCard           | 按日历展示条目/集数和封面                                             | “今天/本周有什么更新”                | 不能合并我的在看、episode progress、更新计划；没有 timezone/as-of             | 日期标题重复、卡片横向信息密度高；放送日多时滚动成本高                       | 应成为 Calendar + personal schedule 两种 view model |

## 直接影响用户价值的缺失

### 信息层级

- 只有摘要层，没有“结果为什么命中”的过滤、排序和 ConceptResolver 解释。
- 统计数字没有分子/分母、样本数、快照时间或来源级别。
- relation/cast/staff 不能用同一套 identity evidence 表达。
- 缺失数据、未授权、过期缓存、部分分页与低置信度没有一等视觉状态。

### 密度与移动端

- 固定横向卡片适合桌面截图，不足以承载 20–50 行搜索结果和多层关系。
- CJK 长标题、日文/中文双名、别名、职位和多 CV 场景需要可预测的 2 行/3 行截断与完整值辅助显示。
- 图片应是增强信息，而不是卡片成功与否的前提；源图加载失败不能把可用数据降级成不可读卡片。
- 大量标签、评分、状态和来源 badge 需要优先级，不应全部使用同一字号/颜色。

### 证据与安全

- Renderer 必须区分 official API、HTML observed、derived 和 user-private。
- private/认证字段不得被保存到公共 artifact 或截图缓存。
- 资产处理失败、源图类型错误、SSRF block 与“源数据没有图”需要不同 warning；不能都只显示 No Image。

## Renderer 2.0 产品目录

以下是建议的产品目录，不是模板实现顺序。所有 view model 都应含 `dataState`, `evidence`, `freshness`, `confidence` 和 `missingFields`。

| View                  | 主要用户问题                                   | 数据依赖                                                        | 版式/移动策略                                                  | 必须表达的状态                                      |
| --------------------- | ---------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------- |
| `SubjectOverview`     | 这部作品是什么，为什么值得看？                 | subject detail、score/tags、cast/staff 摘要、relation links     | 顶部 identity + 可折叠摘要；封面为可选左/上区                  | source、as-of、missing image、NSFW/locked           |
| `SubjectDeepDive`     | 作品的剧集、简介、制作、统计、社区入口是什么？ | subject、episodes、cast/staff、stats/community optional         | section rail；移动端按用户问题分段，不把所有字段塞一屏         | partial sections、auth/HTML unavailable             |
| `SearchResults`       | 哪些条目符合我的条件？                         | QueryResult rows、facets、filter explanation、pagination        | 桌面 table/card toggle；移动端单列 row，标题优先               | exact/ambiguous concept、sort、coverage、no results |
| `SeasonRanking`       | 本季/某年谁排在前面？                          | season cohort、score/heat/rank、tie-break、sample size          | 名次/指标突出；长列表可分组；移动端 sticky filter summary      | ranking definition、retrievedAt、tie-break          |
| `Cast`                | 完整主要角色和 CV 是谁？                       | subject characters/actors、role classifier、person IDs          | 主角/配角分组；角色与 CV 双列在宽屏、上下堆叠在手机            | role unknown、duplicate identity、partial page      |
| `Staff`               | 哪些人负责哪些职位？                           | subject persons、normalized roles、person links                 | 按职位 accordion；职位/人物 toggle                             | raw relation label、unmapped role                   |
| `PersonProfile`       | 这个人是谁，参与过什么？                       | person detail、recent works、characters、staff、collabs         | header identity + tabbed work graph；手机先显示核心履历        | date coverage、media filter、identity confidence    |
| `PersonWorkload`      | 过去 3/6/12 月工作量如何变化？                 | analytics result、monthly buckets、role/media filters           | KPI + line/bar trend + exclusions table；手机纵向              | formula version、window、TV-only、unknown rows      |
| `CommunityTrending`   | 哪些作品最近讨论最热/增长快？                  | provider snapshots、topic/reply/comment counts                  | source badge + as-of；不要伪造实时；移动端显示基数和速度       | HTML observed、coverage、stale/not computable       |
| `Stats`               | 评分/收藏/完成率如何分布？                     | stats provider/API summary、histogram、sample size              | 分布图 + metric definition + caveat                            | observed vs derived、sample size、source            |
| `Relations`           | 系列怎么连接、应该怎么观看？                   | subject relation graph、dates、order policy                     | 图/列表双视图；手机默认列表并显示每条 edge reason              | cycles、ambiguous order、unresolved node            |
| `CollectionDashboard` | 我的列表/进度/本周计划如何安排？               | auth collections、episode progress、calendar、backlog analytics | status tabs + compact rows + weekly agenda；私密 artifact 隔离 | auth required、private、estimated remaining         |

## 视觉参考研究（不复制资产/设计）

参考观察而非素材来源：

- [Bangumi 条目页](https://bgm.tv/subject/41529)：实体页采用密集信息侧栏、分区入口、评分/标签/关系等层级。
- [Bangumi 移动/新版入口](https://next.bgm.tv/)：导航和 discovery 模块适合拆为 query-specific sections，而不是一个无限卡片。
- Discord/QQ 类消息卡的共同经验：头像/身份是辅助信息，时间、来源和正文状态应有明确 hierarchy；不能把社交视觉误当作数据可信度。
- 现代动画列表卡的共同经验：封面、标题、评分、状态是首屏高优字段；长摘要、别名、制作组应折叠或后置。

需遵守的设计原则：

1. CJK 优先：标题/人名保持原文，中文名作为明确 secondary label，不用不可逆的截断替代原值。
2. 高密度但可扫描：同一行只保留一个主指标，次级指标分组，来源/置信度用小但可读的 badge。
3. 手机先看答案：先显示命中数量、筛选、核心 rows，再展开 evidence/缺失项。
4. 图片可选：图片失败时保持 identity、标题、指标和 source links 可读。
5. “未找到”“不可计算”“无权限”“过期”是不同状态，使用不同文案和操作建议。
6. 不复制 Bangumi 的版权资产或视觉细节；只提炼信息层级和响应式原则。

## Renderer 2.0 验收问题

- 一个 40 字中文标题、日文原名和两个别名是否仍能识别主标题？
- 20 个条目、10 个角色和 8 个职位在手机宽度是否能扫描而不依赖横向滚动？
- 结果包含一个 ambiguous concept、一个 stale HTML source、一个 missing image 时，用户能否区分三者？
- private collection 输出是否在 artifact、日志、错误和 PNG metadata 中都不泄露？
- 同一 query 的 JSON 与 PNG 是否使用同一排序、数量、过滤解释和 evidence？

## 与封面调查的关系

封面源与当前 AssetResolver 的具体复现见 [`renderer-cover-investigation.md`](renderer-cover-investigation.md)。该问题属于资产网络/解析链路，不能用单纯 CSS 调整掩盖；Renderer 2.0 仍应让无图/失败图保持可读并显示诊断状态。
