# OP-003 — capability-specific public community source contract recheck

**审查日期：** 2026-10-15。**判定：** 对当前可核验的一手证据，完成为 **NO_SAFE_VARIANT / CLOSED_NO_SAFE_SOURCE**。这表示当前没有一条被 Bangumi 公开支持、能满足 OP-003 且合同足够完整的来源；不表示 Bangumi 永远不会提供这种来源。

**范围：** 只审阅 Bangumi 官方静态开发文档、官方 OpenAPI / 前端 API schema 与版权/开发者协议。检查时的官方仓库 `master` 头：`bangumi/server` `ba9ba234f718c18193ae15bed45e5501ae5b856d`、`bangumi/dev-docs` `d959dc6ab2016d00e877712d01038f8cb740ef6c`、`bangumi/frontend` `9c13933952db4ca37b275b2789300570eeacca31`。未请求任何 Bangumi 生产 API、社区页面/内容、HTML、RSS 或 `/p1` 运行时；未使用账号、OAuth、QQ、TIM，也未收集或保留社区数据。

本报告补充并收窄 2026-10-04 的 PariyaAgent 本地 OP-003 source-contract 审计，以及本仓库 2026-10-13 的 [Run #95 community source contract recheck](run95-community-public-source-contract-2026-10-13.md)：后者只审阅 v0，因此本次特别核对了官方文档所称的旧版未版本化 API，并将“没有可验证合同”和“没有该能力”明确区分。

## 已核验事实

1. **公开 API 与旧版 API 的官方定位。** Bangumi 开发文档称 `/v0/` 为新的公开 API，代码在 `bangumi/server`；无 `/v0/` 的旧 API 仍为兼容而可访问，但已停止维护、不再推荐使用，相关 API 文档已隐藏。文档未提供可供核验的旧 API 社区 endpoint/schema。由此只能得出旧 API 目前没有可验证的社区来源合同，不能据此断言其未公开代码中绝无相关功能。[Bangumi 官方开发文档](https://github.com/bangumi/dev-docs/blob/d959dc6ab2016d00e877712d01038f8cb740ef6c/README.md#L19-L43)

2. **当前公开 v0 不定义话题/回复来源。** 对同一时点的完整官方 v0 OpenAPI 路径和 schema 进行核对，没有找到 subject topic、reply 或讨论历史的公开 route/schema。公开接口包含条目详情和条目关联关系；`GET /v0/subjects/{subject_id}/subjects` 是条目关系，不是讨论流，也没有讨论事件时间。[官方 `bangumi/server` v0 OpenAPI 全文](https://github.com/bangumi/server/blob/ba9ba234f718c18193ae15bed45e5501ae5b856d/openapi/v0.yaml)，[条目关系操作](https://github.com/bangumi/server/blob/ba9ba234f718c18193ae15bed45e5501ae5b856d/openapi/v0.yaml#L459-L489)

3. **相近指标不是讨论热度。** v0 条目搜索把 `sort=heat` 定义为收藏人数；用收藏数、评分、排名或条目关系替代讨论活跃度/增量不符合该 API 的字段语义。[官方 v0 OpenAPI 的搜索排序说明](https://github.com/bangumi/server/blob/ba9ba234f718c18193ae15bed45e5501ae5b856d/openapi/v0.yaml#L54-L72)

4. **新网站有结构化讨论 API，但官方称其为私有 API。** `bangumi/frontend` schema 列出 `GET /p1/subjects/-/topics`（最新条目讨论）和 `GET /p1/trending/subjects/topics`（热门条目讨论）；两者只有 `limit`/`offset` 分页参数，并声明 `CookiesSession` 与 `HTTPBearer` 安全方案。返回结构可以关联条目和讨论回复，但 schema 没有定义可供第三方用的时间窗、增量查询或“突然增加”判定公式。[最新讨论操作](https://github.com/bangumi/frontend/blob/9c13933952db4ca37b275b2789300570eeacca31/packages/client/api.json#L14340-L14411)、[热门讨论操作](https://github.com/bangumi/frontend/blob/9c13933952db4ca37b275b2789300570eeacca31/packages/client/api.json#L15485-L15557)、[SubjectTopic 结构](https://github.com/bangumi/frontend/blob/9c13933952db4ca37b275b2789300570eeacca31/packages/client/api.json#L3476-L3497)

   官方开发文档明确将新网站前端 API 称为“私有 API”：专为新网站前端开发、使用 cookies session、仍在开发、无兼容性保证且不支持跨域。因而 `/p1` 的 schema 证明网站内部存在结构化讨论读面，不构成 PariyaAgent 可依赖的公开第三方合同。[Bangumi 官方开发文档：私有 API](https://github.com/bangumi/dev-docs/blob/d959dc6ab2016d00e877712d01038f8cb740ef6c/README.md#L45-L63)

5. **开发者条款没有补足网页采集授权。** Bangumi 版权声明指出用户原创日志、吐槽、图片版权归用户，未经用户许可不得转载或使用；开发者协议要求在 API 提供的接口范围内获取数据，并禁止以侵犯或可能侵犯 Bangumi 或用户权益的方式使用爬虫或类似方式收集/摘录。页面没有针对 OP-003 指定 HTML 页面的第三方采集、展示、缓存、保留、删除、署名或复用合同。本报告据此只判定网页路线未获当前证据批准，不作更广泛的法律判断。[Bangumi 版权声明及开发者平台使用协议](https://bgm.tv/about/copyright)

## 能力边界与推断

- **推断：**“最近哪部动画突然讨论多起来了？”至少需要定义动画总体、讨论事件或活动指标、比较窗口/基线、条目关联、排序/阈值和覆盖范围。一次“最新”或“热门”列表即使能列出当前条目，也没有证明变化幅度；累计回复数或最后活动时间同样不能独立证明“突然增加”。这一点符合 Product Charter 对历史观察、公式、窗口和覆盖证据的要求。[Product Charter — Sources and evidence](../agent/PRODUCT_CHARTER.md#L73-L116)
- **已核验事实 + 推断：**v0 不提供可用讨论事件源；Legacy API 没有可审核的当前文档合同；`/p1` 为私有且没有变化窗口合同；官方条款也未给出具体 HTML 使用许可。因此没有当前安全、可复现且来源范围清楚的正向实现变体。HTML 仍可在未来单独研究，但须先有该具体来源的当前条款/robots、署名、隐私/删除、保留和分页覆盖合同；不能把可在浏览器访问等同于产品授权。
- 本结论不是声称旧 API 绝无社区数据、所有 HTML 使用都被禁止、或未来的公开 API 不可能支持此功能。它仅说明截至本次核对，没有一份可支持该产品承诺的公开社区来源合同。

## 最终处置

本 Epoch 将产品机会 **OP-003** 从 `RESEARCH_READY` 关闭为 `CLOSED_NO_SAFE_SOURCE`，证据为本报告；这不关闭仍为 `PARTIAL` 的 G10、G11、G21 场景能力。若要恢复讨论热度或增量能力，应在 Bangumi 发布有第三方支持的版本化公开讨论 API，并明确事件/计数语义、窗口、覆盖/分页与速率；或者对某个具体 HTML 源完成单独的当前条款与覆盖审查并显式 allowlist 后再重开。
