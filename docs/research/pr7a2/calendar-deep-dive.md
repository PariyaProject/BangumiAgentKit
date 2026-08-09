# Calendar 深度审计

## 最终分类

**推荐分类：`LEGACY_PLUS_V0_HYDRATION`。**

Calendar 的“本周放送集合”和星期分组以 S2 legacy `/calendar` 为主；条目详情、角色、剧集和关系需要时再用 S1 v0 hydration。网页 S5 可作为显示差异和 fallback 证据，S3 `/p1/calendar` 仅作为 INTERNAL_STRUCTURED 观察面，不作为默认公共依赖。

### 结论记录

**FACT**：`GET https://api.bgm.tv/calendar` 当前返回 7 个 weekday 对象，items 使用 `Legacy_SubjectSmall`；v0 schema 没有等价 `/calendar` operation。

**EVIDENCE**：[`open-api/api.yml`](https://raw.githubusercontent.com/bangumi/api/master/open-api/api.yml) 的 `/calendar` 和 `getCalendar`；[`open-api/v0.yaml`](https://raw.githubusercontent.com/bangumi/api/master/open-api/v0.yaml) 当前 55 个 operation 中没有 `/calendar`；官方文档列出 legacy `/calendar`：[`bangumi.github.io/api`](https://bangumi.github.io/api/)。

**REASONING**：Calendar 是 S2 专属入口，不能写成“v0 calendar”。v0 的 subject/episode 读取能补详情，但不能替代 legacy 的 weekday grouping 和集合语义。

**CONFIDENCE**：HIGH。

**ALTERNATIVES**：官方新 frontend 也使用 `/p1/calendar`，但 frontend client README 将其归为 private API；若未来需要新版站点的 watchers/`SlimSubject` 形态，可做显式实验 provider。

**IMPLEMENTATION IMPLICATION**：先请求 S2，规范化为 `CalendarDay[]`，按 subject id 批量或按需从 S1 hydration；每个字段保留来源，不把 S5/S3 静默合并进 S2。

## 三个面上的字段

| 字段/语义            | S2 legacy API                           | S3 `/p1/calendar`               | S5 `bgm.tv/calendar`                               | 当前判断                                |
| -------------------- | --------------------------------------- | ------------------------------- | -------------------------------------------------- | --------------------------------------- |
| 星期分组             | `weekday.{en,cn,ja,id}`                 | 对象 key `"1"`…`"7"`            | 页面 `<term>/<definition>`、weekday class          | S2 canonical；S3/S5 adapter 各自转换    |
| subject id/link      | `id,url`                                | `subject.id`                    | `/subject/{id}`                                    | 可用，需 id 去重                        |
| 中/日名称            | `name,name_cn`                          | `subject.name,nameCN`           | 卡片上显示中/日名称                                | 规范化时保留两个原值                    |
| 简介、封面           | `summary,images`                        | `SlimSubject`/images            | 封面与标题为可见字段                               | S2 基本可用；详情用 S1/S3               |
| eps / eps_count      | 有                                      | 取决于 `SlimSubject`/detail     | Calendar 卡片不稳定展示                            | S2 直接；缺失时不猜                     |
| score/rating/rank    | 有 `rating,rank`                        | `SlimSubject.rating`            | 页面 Calendar 卡片不显示完整值                     | S2/S3 可用，S5 不应解析成评分           |
| collection counts    | `collection`                            | `watchers` 为当日 watchers 语义 | 页面 header 有今日 watchers，卡片不必有全量 counts | 不能把 watchers 与 doing 总数无条件等同 |
| 具体放送时间/episode | Calendar schema 无完整 episode schedule | 未证明为完整 episode schedule   | 页面显示“每日放送”，不是完整播出事件表             | 需要 S1 episodes/未来专门 source        |

## 实测差异（同一研究日的相邻取样）

研究日期 `2026-08-09`，所有请求使用识别性 UA、只读、低频。由于源站数据在请求间会变化，以下数字是 observation，不是 fixture：

| 面                          | 观察                                                                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| legacy API                  | 7 日 item 总数 115；星期日 21；星期日 `collection.doing` 求和 48174；响应 `application/json`，`Cache-Control: max-age=3600`，CORS `*`                       |
| old website HTML            | header 显示“本季度共 116 部番组，今日上映 21 部。共 48174 人收看今日番组”；页面可见 subject link 去重后 115；没有可复用的 weekday/collection hydration JSON |
| frontend private structured | `/p1/calendar` 返回 7 个 key；另一次取样 item 总数 114、星期日 21、watchers 求和 47844；响应无 `Cache-Control`/ETag/Last-Modified，也没有观察到 CORS header |

### 差异解释

**FACT**：网站 headline 116 与可见去重条目 115 不一致；S2 与网页某些 count 相同；S3 在另一次读取出现 114/47844。

**EVIDENCE**：[`bgm.tv/calendar`](https://bgm.tv/calendar)、[`api.bgm.tv/calendar`](https://api.bgm.tv/calendar)、官方 frontend private schema [`packages/client/api.yaml`](https://github.com/bangumi/frontend/blob/master/packages/client/api.yaml)。

**REASONING**：最稳妥的解释是请求时点、聚合范围或数据刷新不同；不能从一次差异推出“某一面错误”，也不能把 headline 总数当作逐条 item 总数。

**CONFIDENCE**：MEDIUM（差异已观察，具体后台聚合原因未由公开 schema 证明）。

**ALTERNATIVES**：网站可能包含不可见/重复/季节聚合项；p1 与 legacy 可能来自不同刷新缓存或过滤版本。

**IMPLEMENTATION IMPLICATION**：输出应同时显示 `source`, `retrievedAt`, `visibleCount`, `reportedSeasonCount`，计数冲突时标为 `partial/conflicted`；不要用 Calendar HTML 反向校正 API。

## 方案比较

| 方案                       | 判断                   | 原因                                                                    |
| -------------------------- | ---------------------- | ----------------------------------------------------------------------- |
| `LEGACY_ONLY`              | 不足                   | 不能补 v0 详情，也不能解释新版 watchers/网站差异                        |
| `LEGACY_PLUS_V0_HYDRATION` | **首选**               | 官方当前可验证、契约边界最清晰；S2 集合 + S1 详情各负其责               |
| `LEGACY_PLUS_WEBSITE`      | 次选 fallback          | 能补网站可见文案，但 DOM/计数口径易变                                   |
| `WEBSITE_STRUCTURED`       | 实验性                 | `/p1/calendar` 字段好用，但官方 frontend 明确为 private API，缺公共 SLA |
| `HTML_REQUIRED`            | 仅限验证/极端 fallback | Calendar 主要字段已有 S2；HTML 只在验证显示口径时需要                   |

## 已知限制

1. legacy 响应有约 1 小时缓存；放送临近时不能宣称秒级实时。
2. weekday/air date 不等于每个 episode 的精确播出时间；需要 episode source 和时区策略。
3. website headline 与可见 item 数可能不一致；必须保留两个字段。
4. `collection.doing` 是官方计数 bucket，不能直接解释成去重用户数；S3 `watchers` 也不能无条件等同它。
5. Calendar 不覆盖用户自己的 episode progress；“我的本周计划”必须增加 S1 authenticated collection/episode source。
6. 站点 issue 列表曾出现 Calendar 时间/结果相关问题记录，见官方 [`api` issues](https://github.com/bangumi/api/issues)；这里只记作 operational risk，不断言具体 issue 永久复现。
7. `/p1/calendar` 当前没有稳定缓存 header，且 schema 属于 private API；不应作为默认降级路径。
