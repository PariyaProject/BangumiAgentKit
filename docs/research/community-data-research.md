# Bangumi 社区数据研究

> PR-7A 研究交付物。研究目标是判断社区智能的可行边界，不把网页抓取误称为官方 API，也不在本阶段实现 HTML provider。

## 结论先行

社区数据对“当前讨论热度”“主题/回复增长”“小组活动”“短评/长评摘要”有明显产品价值，但官方 v0 没有 comments、reviews、board/topic、Rakuen、groups、blogs 或 activity feed endpoint。推荐 Provider 决策为：

> **方案 B：只为社区能力提供显式、可关闭、限速、缓存、带 provenance 的 raw HTML provider；官方 API 仍是所有结构化实体/收藏/关系的优先来源。**

不是方案 A（只用 official API）：会无法回答社区核心问题；也不是方案 C（全站 HTML fallback）：会让 API 与网页字段不可区分、扩大抓取面和维护风险。

## 源清单与观察

| 来源            | 观察到的内容                                                                                                                               | 可支持的社区指标                                          | 官方 v0                  | HTML 稳定性/风险                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------ |
| Rakuen 全局聚合 | [topiclist](https://bgm.tv/rakuen/topiclist?type=mono) 按全部/小组/条目/剧集/人物/虚拟/现实聚合主题，行内有实体名、回复/热度摘要和相对时间 | 当前活跃主题、实体讨论计数、短窗口 activity               | 无                       | 中：页面有动态/聚合层，排序权重未公开；必须解析绝对/相对时间并保存抓取时刻     |
| 条目讨论板      | [subject/41529/board](https://bgm.tv/subject/41529/board) 显示主题标题、作者/用户组、回复数、日期/最后活动及主题链接                       | topic count、reply count、topic velocity、最近活跃主题    | 无                       | 中：URL 模式稳定，但分页/字段展示可能变化；登录、隐藏和审核状态影响覆盖        |
| 条目短评        | [subject/41529/comments](https://bgm.tv/subject/41529/comments) 按全部/想看/看过/在看/搁置/抛弃展示用户、状态、时间和文本                  | comment count、按状态分布、短窗口新增评论；可选小样本摘要 | 无                       | 中低：正文和分页适合页面阅读，不适合无边界复制；用户隐私、删除和登录状态要尊重 |
| 条目长评        | [subject/41529/reviews](https://bgm.tv/subject/41529/reviews) 显示标题、作者、日期、回复数和摘要/正文入口                                  | review count、reply count、主题摘要、活跃度               | 无                       | 中：内容结构可观察但正文版权/条款风险高；默认只取元数据和链接                  |
| 用户博客/日志   | `/user/{username}/blog`、条目博客入口                                                                                                      | 用户/条目活动、时间序列、主题词（若允许）                 | 无                       | 低到中：内容类型多，权限/删除/分页变化；不作为默认趋势源                       |
| 小组            | [group](https://bgm.tv/group) 与 `/group/{id}/topic`                                                                                       | 小组成员数、主题数、回复速度、最近活动、作品聚类          | 无                       | 中低：列表和主题页可观察；需要 group allowlist 与独立 parser                   |
| 首页/个人首页   | [next.bgm.tv](https://next.bgm.tv/)、[user/roach](https://bgm.tv/user/roach)                                                               | 模块级推荐/活动、用户收藏统计、目录/小组入口              | 无                       | 低：编排随版本变化；仅用于产品侦察，不作为稳定数据源                           |
| 目录/Index      | [index](https://bgm.tv/index) 与 `/index/{id}`                                                                                             | 专题目录更新、主题清单、创建者和条目数                    | 部分有 index/subject API | 中：结构化 index API 优先；网页只补 discovery/排序                             |

## 能力可行性矩阵

| 用户能力              | 数据可得性                                        | API | HTML                   | 是否可可靠实现 | 前置条件                                                 |
| --------------------- | ------------------------------------------------- | --- | ---------------------- | -------------- | -------------------------------------------------------- |
| 当前讨论热度 Top N    | 单次页面可观察                                    | 否  | Rakuen/board           | 有条件         | 明确 heat 是源站显示值还是自定义 count；保存 as-of       |
| 24 小时新增主题/回复  | 单次页面通常有时间/回复                           | 否  | board/Rakuen           | 有条件         | 两次完整快照；相对时间以抓取时间解析                     |
| 7 日讨论增长          | 需要历史                                          | 否  | 定时 HTML snapshot     | 有条件         | 至少两个同口径快照；没有快照返回 not_computable          |
| comment velocity      | 评论列表有时间/状态                               | 否  | comments               | 有条件         | 分页覆盖、状态筛选、删除/隐私处理                        |
| review/reply velocity | 长评有日期/回复数                                 | 否  | reviews                | 有条件         | 不复制正文；只保存元数据/链接                            |
| topic/reply count     | 主题板显示                                        | 否  | board/topiclist        | 中             | 去重 topic URL；区分总回复和新增回复                     |
| 用户/小组活跃度       | 部分列表有作者和时间                              | 否  | groups/blogs           | 低到中         | 仅公开内容；不要推断真实用户活跃度                       |
| 作品/实体讨论聚类     | Rakuen 行可映射实体                               | 否  | Rakuen                 | 有条件         | subject/episode/person identity resolution；未解析行单列 |
| 社区主题摘要          | 标题和少量文本可得                                | 否  | comments/reviews/board | 有条件         | 只做受限摘要；显示采样范围、语言和偏差                   |
| 收藏 velocity         | 公共用户 collection 有 `updated_at`，但没有事件流 | 否  | user/collection        | 低             | 只有历史用户快照才能计算；不把当前 timestamp 当新增事件  |

## Provider B 设计边界

### 允许的调用面

建议初始只 allowlist：

```text
/rakuen/topiclist?type=mono
/subject/{id}/board
/subject/{id}/comments
/subject/{id}/reviews
/group
/group/{id}/topic
```

每个 adapter 只返回规范化的元数据和 source link：

```ts
type CommunityRecord = {
  provider: 'rakuen_html' | 'subject_board_html' | 'comments_html' | 'reviews_html' | 'group_html';
  entity?: { kind: 'subject' | 'episode' | 'person' | 'group'; id: number };
  kind: 'topic' | 'comment' | 'review' | 'group_activity';
  sourceUrl: string;
  observedAt: string;
  sourcePublishedAt?: string;
  replyCount?: number;
  heat?: number;
  title?: string;
  author?: { publicId?: string; displayName?: string };
  parserVersion: string;
  rawHash?: string;
};
```

默认不保存全文。若未来提供摘要，必须限制长度、去除凭据/私密信息、显示“基于可见样本”，并保留原始链接而非把摘要当作官方观点。

### 缓存与刷新

| 数据                      |          建议 TTL | 失败策略                                      |
| ------------------------- | ----------------: | --------------------------------------------- |
| Rakuen topiclist          |            5 分钟 | 返回上次成功快照并标 stale；不可连续重试      |
| subject board metadata    |           10 分钟 | 页面失败时保留旧计数和 as-of                  |
| comments/reviews metadata |        15–30 分钟 | 只做按 subject 的显式查询，不能全站扫         |
| groups list               |        30–60 分钟 | 版本化 parser；失败不阻塞 official API 查询   |
| historical snapshot       | 由 scheduler 控制 | 固化 source/parser/filter，保留缺页和失败记录 |

缓存键必须包含 provider、URL 参数、解析器版本和 scope。不能把认证用户看到的私有内容放进公共缓存。

### 速率、重试与停止条件

- 默认串行/低并发；每个 host 有 token bucket 和 exponential backoff。
- 只遵循明确的公开页面和站点允许范围；不绕过登录、验证码、robots 或访问控制。
- 429、403、5xx、解析器 schema mismatch 连续出现时停止该 provider，并将状态标成 unavailable。
- 不用浏览器自动化作为默认抓取器；只有页面确实由脚本渲染且得到批准时才评估。
- 请求必须带识别性的 User-Agent、超时和最大响应大小；不把社区 provider 作为 API 失败后的静默 fallback。

## 条款、隐私与 provenance

本研究不对站点条款作法律结论。进入实现前需要逐项检查：

1. Bangumi 的 robots、使用条款、版权与内容删除边界。
2. 公开评论/日志的个人信息、用户删除和私密状态。
3. 是否可以保存计数、标题、用户名、摘要、原文 hash 和链接；保存多久。
4. 对外答案是否应显示用户名，还是只显示匿名化计数。
5. 社区来源是否允许商业/再分发；第三方 downstream 的责任。

所有 community 结果都应附：provider、source URL、observedAt、parserVersion、cacheState、coverage、termsReview 状态。没有这些字段的结果不能作为“当前热度”硬事实输出。

## 偏差与质量

- Rakuen 代表“可见且被聚合的讨论活动”，不代表全站所有用户意见。
- board/review/comment 页面可能分页、按状态筛选、隐藏或只显示部分内容；Top N 要显示覆盖说明。
- 回复数是活动量，不是内容质量；热度排序权重未知时不应重新命名为“质量排名”。
- 24h/7d 依赖抓取时间和相对时间解析；跨时区必须固定 Asia/Tokyo 或显式传入 timezone。
- 主题的实体映射失败时保留 unresolved record，不能按名称模糊合并到错误条目。

## 结论

社区智能可行，但应作为隔离的、显式开启的 provider 产品面。优先做计数/时间/链接级 intelligence；长评/评论正文和用户画像属于后续研究，不能成为 API 读取失败时的默认补偿路径。PR-7E 前不应承诺“全站实时热度”或“完整社区趋势”。
