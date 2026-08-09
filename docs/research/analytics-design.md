# Bangumi Analytics Layer 设计研究

> PR-7A 设计产物。分析层是对可追溯数据的窗口化聚合，不是模型猜测，也不在本次实现。

## 设计原则

1. 先定义实体、事件时间和观察窗口，再做聚合；检索时间不能冒充作品发生时间。
2. 所有指标带输入覆盖率、来源、快照时间、公式版本和偏差说明。
3. API 摘要、HTML 页面和用户私有数据分层；不同来源不无标记地混合。
4. 没有历史快照就不能回答增长率；没有认证就不能回答“我的”。
5. 去重必须以稳定 ID 为主，名称只用于展示和 unresolved identity 警告。

## 统一输出模型

```ts
type AnalyticsResult<T> = {
  analysis: string;
  asOf: string;
  window?: { start: string; end: string; timezone: string };
  rows: T[];
  metrics: MetricDefinition[];
  coverage: { requested: number; observed: number; missing: number };
  evidence: EvidenceRef[];
  bias: BiasNote[];
  confidence: 'high' | 'medium' | 'low' | 'not_computable';
  formulaVersion: string;
};
```

推荐把数值分为：`observed`（源数据直接给出）、`derived`（确定性计算）、`estimated`（有明确假设的估计）。默认不将 estimated 与 observed 混排。

## 十类最低可行分析

| 分析                     | 输入                                                                        | 数据源                                                                                           | 聚合                                                                                               | 时间窗口                                    | 主要偏差                                                                           | 置信度规则                                                                                                | 输出                                                                        |
| ------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `PersonActivityAnalysis` | person ID；角色/职位；media；date window；是否去重 subject                  | v0 person detail、person→subjects/characters、subject detail；必要时 HTML person works 作为补充  | 按 person、role、subject、media 计数；合作边按共同 subject 去重                                    | 3/6/12 月或自定义 air date/参与日期         | air date 缺失；同一作品多职位重复；网页近期列表可能截断；活动不等于劳动量          | high：全量 API 关系且日期完整；medium：缺日期≤10%；low：HTML 截断/角色不确定                              | 作品数、角色数、职位数、按月曲线、缺失列表                                  |
| `VoiceActorWorkload`     | person；TV-only；main/support；窗口；是否包含剧场/OVA/游戏/音乐             | person→characters 的 `staff`，character→subjects，subject type/platform/date；人物页可作交叉证据 | unique subjects、unique characters、main/support counts；按月/季分桶；与前窗口 delta/%             | 3/6/12 月；比较两个相邻窗口                 | `staff` 角色标注不统一；air date 是作品首播而非配音日期；跨媒体混淆；重复角色/系列 | high：subject/character/person IDs 完整且 media 明确；medium：角色分类需要规则；low：缺日期或只有网页摘要 | anime CV 数、TV-only 数、主/配角数、unique subjects、月工作量、趋势、排除项 |
| `StaffActivity`          | person；职位集合；media；window                                             | v0 person→subjects with `staff`; subject persons; person detail                                  | unique subject count by role、co-credit network、first/last activity                               | 1/3/5 年或季度                              | 职位别名、同人多职重复、作品上线时间与制作时间不同                                 | high：relation label exact；medium：role mapping；low：职位非规范/缺日期                                  | 作品、职位分布、趋势、合作人 Top N、证据                                    |
| `SubjectPopularity`      | subject(s) 或 query；score/rating_count/rank/collection；community optional | v0 subject detail/search；HTML stats/Rakuen optional                                             | 标准化分数、排名、评分人数、收藏桶；community 另列                                                 | 当前快照；若有快照可日/周/月                | rank/heat 定义不透明；站点总量变化；样本自选择；社区源偏差                         | high：API direct fields；medium：HTML stats；low：community-only/unknown formula                          | 指标卡、对比表、样本量、as-of、来源分层                                     |
| `SeasonRanking`          | season/year；media/type；concept/tag；metric/sort；top N                    | `GET /v0/subjects`、`searchSubjects`；tag resolution；calendar for airing                        | filter cohort 后按 score/heat/rank/collection 排序，tie-break rating_count/id                      | 季节窗口或 air date；当前/历史需快照        | current rank 是动态；tag 概念歧义；分页截断；季节边界                              | high：API filter/complete pages；medium：concept candidates；low：网页排行无契约                          | 排名、分数、过滤解释、样本量、tie-break                                     |
| `SubjectTrend`           | subject；metric；snapshot store；window                                     | API/HTML 定时快照；源站 stats/trend link 仅作证据                                                | delta、slope、growth rate、rolling average；异常/缺失检测                                          | 7/30/90 日或多月                            | 快照间隔不均；排名重算；站点改口径；抓取失败造成假下降                             | high：>=2 可比快照且口径不变；not_computable：单快照                                                      | 趋势线、变化量、采样时间、缺失区间、口径                                    |
| `CommunityTrend`         | scope(Rakuen/board/comments/reviews/groups)；entity；metric；window         | opt-in HTML provider、topiclist/subject board/reviews/comments/groups；无官方 v0                 | topic/reply/comment count、velocity、unique active threads；快照 delta                             | 24h/7d/30d；默认短 TTL                      | HTML 只显示部分结果；相对时间解析；热度权重未知；热门/活跃不是质量；限流缺页       | high：同一 provider 两个完整快照；medium：分页覆盖有限；low：单次抓取                                     | Top N、增长、活跃主题、source URL、coverage、terms/cache note               |
| `UserTasteProfile`       | authenticated user；collection statuses/ratings/tags；可选 person/relations | authenticated v0 public/private collections、subject/tags/persons；不读取评论正文为默认          | tag/type/person weighted counts、rating distribution、season/media preference；可选 recency weight | 近 6/12/24 月或全部收藏；历史状态需事件快照 | 用户自选样本；评分偏差；缺标签；私密数据泄露/缓存风险；收藏不是观看行为            | high：当前授权 collection；medium：tag/person coverage；not_computable：历史偏好无快照                    | 偏好画像、证据条数、置信度、可解释 top concepts；不输出敏感推断             |
| `CollectionBacklog`      | authenticated owner；status；completed/airing rule；episode progress        | v0 user collections、subject/episode metadata、authenticated episode collection endpoints        | remaining episodes、estimated minutes、completed/incomplete buckets、priority                      | current snapshot；可按本周/本季更新         | 未播/总集数 unknown；specials policy；episode progress privacy；空状态不等于未看   | high：episode collection read + complete episodes；medium：estimated remaining; low：only subject eps     | backlog rows、剩余集数/时长、更新计划、缺失数据                             |
| `SeriesWatchOrder`       | root subject；relation types；order policy                                  | v0 subject relations、subject dates/episodes; optional series HTML                               | graph traversal、cycle detection、topological sort、ambiguous edges                                | static/current snapshot                     | Bangumi relation label不是绝对观看顺序；同系列外传/总集篇规则；日期缺失            | high：acyclic exact relations; medium：policy-inserted dates; low：ambiguous/cycle                        | ordered list、reason per edge、unresolved nodes、confidence                 |

## 指标和计算口径

### 人物/声优工作量

推荐同时输出三个计数，避免“工作量”被一个数字垄断：

- `uniqueSubjects`：按 subject ID 去重的作品数。
- `uniqueCharacters`：按 character ID 去重的角色数。
- `creditRows`：角色/职位关系行数，仅用于透明展示，不作为默认作品数。

角色类型至少分为 `main`、`support`、`unknown`。若站点的关系值不能直接映射，应显示 classifier version 和 unknown rows。TV-only 的判定优先使用 subject type/platform；不能把“动画”字符串自动当成 TV。

窗口默认以 subject `air_date` 的日期归属。缺日期的作品放入 `undated`，不强行塞入检索月。输出月度曲线时空月份显示 0，不删掉中间月份。

### 热度与趋势

`delta = metric(t1) - metric(t0)`，`velocity = delta / elapsed_days`。只有两个快照的 metric 口径、过滤器、分页覆盖和 entity mapping 都相同时才计算。排序可用 `velocity`，但需同时显示原始基数，避免小样本一条新增回复压过大样本。

### 完成率

建议定义并显式展示：

```text
episodeCompletion = watched_main_episodes / known_main_episodes
```

其中 `known_main_episodes` 排除 SP/OP/ED/PV 等非正篇，除非用户选择 include specials。若 subject 只有总集数字且没有 episode-level 状态，结果只能是 `estimated` 或 `unknown`，不能声称是精确完成率。

## 来源分层

| 层级                                | 例子                                           | 可支持的分析                        | 约束                                   |
| ----------------------------------- | ---------------------------------------------- | ----------------------------------- | -------------------------------------- |
| L1 official direct                  | v0 subject/person/character/collection/episode | 过滤、关系、静态指标、个人 backlog  | 只使用契约字段；注意分页和 auth        |
| L2 official + deterministic derived | 关系图、季节排名、角色/作品计数                | 绝大多数 PR-7B/7C                   | 输出公式、coverage 和缺失项            |
| L3 HTML observed                    | stats、Rakuen、board、reviews、groups          | community trend、完整统计、网页排序 | provider opt-in、缓存、条款、解析版本  |
| L4 historical snapshot              | 定时保存的 L1/L3 指标                          | trend、velocity、变化比较           | 没有两个可比时点则 not_computable      |
| L5 user-private                     | current user collection/episode progress       | taste、backlog、weekly schedule     | bearer、私密缓存隔离、不可用于公共排行 |

## 分析层安全与可解释性

- 每个 `AnalyticsResult` 附 `sourceKind` 和 `evidenceIds`；渲染层不能丢掉这些信息。
- 结果按 `observed/derived/estimated` 分栏或用不同 badge，不把估计值伪装成站点原始值。
- 用户画像只做“收藏/评分行为的描述”，不推断年龄、性别、政治或其他敏感属性。
- community 文本默认只保存 URL、标题、计数、时间和可选短摘要；不批量复制正文。
- 认证分析的中间结果不得进入公共 LRU、共享 artifacts 或匿名 MCP cache。

## 验收问题

在任何 analytics 工具进入实现前，应能回答：

1. 指标的分子/分母是什么？
2. 是作品时间、用户事件时间还是抓取时间？
3. 哪些行因缺日期、身份冲突、未授权或分页上限被排除？
4. 是否有足够历史快照回答增长？
5. 结果在 JSON、MCP 和 Renderer 中是否保留同一 evidence/confidence？

## 参考来源

- [固定 v0 OpenAPI](../../openapi/upstream/v0.yaml)
- [Bangumi API OpenAPI mirror](https://github.com/bangumi/api/blob/master/open-api/v0.yaml)
- [水瀬いのり人物页](https://bgm.tv/person/10868)
- [条目统计页示例](https://bgm.tv/subject/41529/stats)
- [Bangumi 日历](https://bgm.tv/calendar)
- [Rakuen 讨论聚合](https://bgm.tv/rakuen/topiclist?type=mono)
