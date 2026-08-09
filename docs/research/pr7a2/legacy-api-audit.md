# Official legacy API 审计

## 结论

**FACT**：当前官方 `open-api/api.yml` 只声明 1 个 operation：`GET /calendar`（operationId `getCalendar`）。

**EVIDENCE**：官方源文件的当前路径和 operation 位于 [`bangumi/api/open-api/api.yml`](https://raw.githubusercontent.com/bangumi/api/master/open-api/api.yml)；官方文档站同时把 `/calendar` 列在 v0 列表之前的 legacy 区域：[`bangumi.github.io/api`](https://bangumi.github.io/api/)。研究时点用 `curl` 读取文件，`^  /` 和 `operationId:` 各只匹配一项。

**REASONING**：所以本报告的“官方 legacy operation count”是 **1 current documented operation**，不是把 v0 的 55 项合并进 legacy，也不是把历史删除路径算入当前接口。

**CONFIDENCE**：HIGH（官方 schema、文档和 live endpoint 三者一致）。

**ALTERNATIVES**：旧客户端仍可能调用已经删除/弃用的路径；这只能标为历史兼容风险，不能当作当前能力。

**IMPLEMENTATION IMPLICATION**：Provider registry 应把 `LegacyCalendarProvider` 单独登记为 S2；不得从 `/calendar` 路径推出一个“legacy subject API”或将它并入 v0 operation registry。

## 当前操作

| 状态                 | Method / path                     | operationId   | 当前响应                                                 | 备注                                                            |
| -------------------- | --------------------------------- | ------------- | -------------------------------------------------------- | --------------------------------------------------------------- |
| `CURRENT_DOCUMENTED` | `GET https://api.bgm.tv/calendar` | `getCalendar` | 7 个 weekday 对象，每项含 `items: Legacy_SubjectSmall[]` | 无需把 schema 当作 v0；公开响应带 `Cache-Control: max-age=3600` |

`Legacy_SubjectSmall` 当前声明了 `id,url,type,name,name_cn,summary,air_date,air_weekday,images,eps,eps_count,rating,rank,collection`；其中 `rating` 含 score/count，`collection` 含 wish/collect/doing/on_hold/dropped。legacy schema 还保留 episode/topic/blog 等类型定义，但它们不代表当前仍有对应 path。

## 历史路径审计

| 路径/能力                                                                  | 历史动作                                                       | 当前状态                                 | 证据                                                                                               |
| -------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `GET /search/subject/{keywords}`                                           | 删除旧关键词搜索                                               | `HISTORICAL_ONLY`                        | [`9b4e4267c0`](https://github.com/bangumi/api/commit/9b4e4267c0) 明确为 `remove legacy search api` |
| `GET /subject/{subject_id}`、`GET /subject/{subject_id}/ep`                | 删除旧条目 API                                                 | `HISTORICAL_ONLY`                        | [`6d5f3ed0f5`](https://github.com/bangumi/api/commit/6d5f3ed0f5)；新条目能力转到 v0                |
| `GET /user/{username}/collections/status`、`GET /user/{username}/progress` | 删除并注明 replacement                                         | `HISTORICAL_ONLY`                        | [`e02eef7da5`](https://github.com/bangumi/api/commit/e02eef7da5)                                   |
| `GET /collection/{subject_id}`                                             | 删除旧单条收藏读取                                             | `HISTORICAL_ONLY`                        | [`8da01e33f3`](https://github.com/bangumi/api/commit/8da01e33f3)                                   |
| `GET /user/{username}/collections/{subject_type}`                          | 删除旧总览                                                     | `HISTORICAL_ONLY`                        | [`5d196b229b`](https://github.com/bangumi/api/commit/5d196b229b)                                   |
| episode status / collection action / update watched eps 系列               | 2022 标为 deprecated，建议迁移到 v0 user collection operations | `HISTORICAL_OR_DEPRECATED`；不得默认调用 | [`d316f213ab`](https://github.com/bangumi/api/commit/d316f213ab)                                   |

这张表按“官方变更记录”审计，而不是按当前站点是否偶尔返回 200 进行猜测。历史文件可能包含比表中更多的旧 schema；没有当前 path 证据时统一归为 `HISTORICAL_ONLY`。

## 不应混淆的三个数字

|   数字 | 含义                                                                       |
| -----: | -------------------------------------------------------------------------- |
| **55** | 当前固定 `openapi/upstream/v0.yaml` 的 v0 operation 数                     |
|  **1** | 当前官方 legacy `api.yml` 的 operation 数，即 `/calendar`                  |
| **56** | 当前官方文档可见的 v0 + legacy 合计；只是 family 合计，不是一个统一 schema |

## 对 PR-7A 旧结论的更正

PR-7A 将 legacy `/calendar` 主要描述为“非 v0 的 legacy surface”，方向正确但不够精确。PR-7A2 固定三个限定：它是官方当前可调用的 **1 项 legacy operation**；v0 中没有等价 `/calendar` operation；网站和内部 `/p1/calendar` 是另外两个来源类，不能倒推为 v0/legacy。
