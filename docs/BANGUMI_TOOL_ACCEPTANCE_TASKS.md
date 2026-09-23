# BangumiAgentKit 逐项验收任务清单

> 生成自 `docs/tool-catalog.json`、`tests/` 与带目录哈希的 `docs/live-probes/` 证据。每一列对应独立验收面；WebChat、MCP 调用、QQ 管线和 TIM 客户端不互相替代。

## 总览

- [x] 每个工具都有直接 `execute` 夹具：96/96。
- [x] 匿名可用的公开 API 工具有逐项实测：65/65；待补 0。
- [x] 匿名公开 API 不适用项已单独分类：31/96；这些工具由账号验收或本地状态验收覆盖。
- [ ] 需要账号的工具完成真实 OAuth/账号验收：33 项目前不能用本地 mock 代替。
- [x] 未认证只读门禁拒绝路径已验证：15/15 项；门禁通过不代表真实账号功能通过。
- [x] 每个工具都有实际 Agent→MCP 模型调用证据：96/96。
- [ ] 每个工具都有 QQ 消息管线端到端证据：当前 0/96。
- [ ] 每个工具都有 TIM 客户端端到端证据：当前 0/96。

状态说明：`目录/Schema` 列指向 `docs/tool-catalog.json` 中该工具由运行时 `ToolRegistry` 生成的精确条目；直接 execute 测试引用列列出调用 `.execute`/`ToolRegistry.executeTool` 或已知执行夹具的文件和行号，证明隔离夹具被执行，不代表真实账号、公开 API 或 QQ/TIM 验收。`◐` 表示有目录/探针源码哈希绑定的只读 ToolRegistry 实测、真实 HTTP 请求、无错误摘要和通过的形状断言；可比对的稳定 ID/计数也会校验。报告不保存数据正文，也不证明完整字段覆盖或长期稳定性；`⬜` 尚未完成；`—` 不适用匿名公开 API（账号必需的私有/写入功能由账号验收列单独跟踪；OAuth 生命周期、本地状态/历史和 operation metadata 没有公开 API 路径）。

| 工具 | Auth | Risk | 注册/Schema目录引用 | 直接 execute 测试引用 | 直接 execute 夹具 | 真实公开 API | 未认证只读门禁 | 账号认证 | Agent/MCP E2E | QQ 管线 E2E | TIM 客户端 | 下一步 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
未认证只读门禁列只记录缺少账号时的安全拒绝；真实 OAuth 与账号授权仍由“账号认证”列单独跟踪。写入/破坏性工具不进入该探针。
| `bangumi.aggregate_subject_cohort` | `none` | `read` | `docs/tool-catalog.json#/0` | `tests/integration/tool-direct-execute-discovery.test.ts:92` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.auth_disconnect` | `required` | `destructive` | `docs/tool-catalog.json#/1` | `tests/integration/tool-direct-execute-account.test.ts:131` | ✅ | — | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.auth_list_accounts` | `none` | `read` | `docs/tool-catalog.json#/2` | `tests/integration/tool-direct-execute-account.test.ts:100`<br>`tests/unit/multi-account.test.ts:150` | ✅ | — | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.auth_remove_account` | `required` | `destructive` | `docs/tool-catalog.json#/3` | `tests/integration/tool-catalog-completeness.test.ts:253`<br>`tests/integration/tool-direct-execute-account.test.ts:121` | ✅ | — | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.auth_start` | `none` | `read` | `docs/tool-catalog.json#/4` | `tests/integration/tool-direct-execute-account.test.ts:88` | ✅ | — | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.auth_status` | `none` | `read` | `docs/tool-catalog.json#/5` | `tests/integration/tool-direct-execute-account.test.ts:84`<br>`tests/unit/sqlite-distribution-matrix.test.ts:107` | ✅ | — | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.auth_switch_account` | `none` | `write` | `docs/tool-catalog.json#/6` | `tests/integration/tool-direct-execute-account.test.ts:114` | ✅ | — | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.call_operation` | `optional` | `read` | `docs/tool-catalog.json#/7` | `tests/unit/audit-account.test.ts:78` | ✅ | ◐ | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.compare_subject_cohorts` | `none` | `read` | `docs/tool-catalog.json#/8` | `tests/integration/tool-direct-execute-discovery.test.ts:85` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.describe_operation` | `none` | `read` | `docs/tool-catalog.json#/9` | `tests/integration/mcp-tools.test.ts:254` | ✅ | — | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_calendar` | `none` | `read` | `docs/tool-catalog.json#/10` | `tests/integration/mcp-tools.test.ts:156` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_calendar_intelligence` | `none` | `read` | `docs/tool-catalog.json#/11` | `tests/integration/mcp-tools.test.ts:194`<br>`tests/integration/mcp-tools.test.ts:227`<br>`tests/semantic/semantic-tools.test.ts:1027` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_character` | `none` | `read` | `docs/tool-catalog.json#/12` | `tests/integration/tool-catalog-completeness.test.ts:200` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_character_collection` | `optional` | `read` | `docs/tool-catalog.json#/13` | `tests/integration/tool-direct-execute-account.test.ts:153` | ✅ | ◐ | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_character_credit_integrity` | `none` | `read` | `docs/tool-catalog.json#/14` | `tests/integration/tool-direct-execute-read.test.ts:234` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_collection` | `optional` | `read` | `docs/tool-catalog.json#/15` | `tests/integration/tool-catalog-completeness.test.ts:220` | ✅ | ◐ | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_collection_backlog` | `required` | `read` | `docs/tool-catalog.json#/16` | `tests/integration/tool-direct-execute-account.test.ts:171` | ✅ | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_collection_dashboard` | `required` | `read` | `docs/tool-catalog.json#/17` | `tests/integration/tool-direct-execute-account.test.ts:177` | ✅ | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_collection_entity_consistency` | `required` | `read` | `docs/tool-catalog.json#/18` | `tests/integration/tool-direct-execute-account.test.ts:183` | ✅ | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_collection_intelligence` | `required` | `read` | `docs/tool-catalog.json#/19` | `tests/integration/tool-direct-execute-account.test.ts:189` | ✅ | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_collection_schedule` | `required` | `read` | `docs/tool-catalog.json#/20` | `tests/integration/tool-direct-execute-account.test.ts:195` | ✅ | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_collection_series_groups` | `required` | `read` | `docs/tool-catalog.json#/21` | `tests/integration/tool-direct-execute-account.test.ts:201` | ✅ | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_episode` | `none` | `read` | `docs/tool-catalog.json#/22` | `tests/integration/tool-catalog-completeness.test.ts:195` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_episode_collections` | `required` | `read` | `docs/tool-catalog.json#/23` | `tests/semantic/collection-read-parity.test.ts:272` | ✅ | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_episode_guide` | `none` | `read` | `docs/tool-catalog.json#/24` | `tests/semantic/episode-guide.test.ts:121` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_episode_integrity` | `none` | `read` | `docs/tool-catalog.json#/25` | `tests/semantic/episode-integrity.test.ts:127` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_episodes` | `none` | `read` | `docs/tool-catalog.json#/26` | `tests/integration/tool-direct-execute-read.test.ts:67` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_index` | `none` | `read` | `docs/tool-catalog.json#/27` | `tests/integration/tool-catalog-completeness.test.ts:210` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_latest_subject_revision` | `none` | `read` | `docs/tool-catalog.json#/28` | `tests/integration/tool-direct-execute-read.test.ts:93` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_my_profile` | `required` | `read` | `docs/tool-catalog.json#/29` | `tests/integration/tool-catalog-completeness.test.ts:229` | ✅ | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_person` | `none` | `read` | `docs/tool-catalog.json#/30` | `tests/integration/tool-catalog-completeness.test.ts:205` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_person_activity` | `none` | `read` | `docs/tool-catalog.json#/31` | `tests/integration/tool-direct-execute-read.test.ts:254` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_person_collaboration` | `none` | `read` | `docs/tool-catalog.json#/32` | `tests/integration/tool-direct-execute-read.test.ts:259` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_person_collection` | `optional` | `read` | `docs/tool-catalog.json#/33` | `tests/integration/tool-direct-execute-account.test.ts:165` | ✅ | ◐ | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_person_profile` | `none` | `read` | `docs/tool-catalog.json#/34` | `tests/semantic/semantic-tools.test.ts:1007`<br>`tests/semantic/semantic-tools.test.ts:1013`<br>`tests/semantic/semantic-tools.test.ts:1053`<br>`tests/semantic/semantic-tools.test.ts:988` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_revision` | `none` | `read` | `docs/tool-catalog.json#/35` | `tests/integration/tool-catalog-completeness.test.ts:241` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_revision_intelligence` | `none` | `read` | `docs/tool-catalog.json#/36` | `tests/integration/tool-direct-execute-read.test.ts:86` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_series_watch_order` | `none` | `read` | `docs/tool-catalog.json#/37` | `tests/integration/tool-direct-execute-read.test.ts:249` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject` | `none` | `read` | `docs/tool-catalog.json#/38` | `tests/integration/mcp-tools.test.ts:126`<br>`tests/integration/mcp-tools.test.ts:88` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_cast` | `none` | `read` | `docs/tool-catalog.json#/39` | `tests/integration/tool-direct-execute-read.test.ts:79` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_comparison` | `none` | `read` | `docs/tool-catalog.json#/40` | `tests/integration/tool-direct-execute-read.test.ts:239` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_identity` | `none` | `read` | `docs/tool-catalog.json#/41` | `tests/integration/tool-direct-execute-read.test.ts:189` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_index_membership` | `none` | `read` | `docs/tool-catalog.json#/42` | `tests/integration/tool-direct-execute-read.test.ts:264` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_overlap` | `none` | `read` | `docs/tool-catalog.json#/43` | `tests/integration/tool-direct-execute-read.test.ts:244` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_overview` | `none` | `read` | `docs/tool-catalog.json#/44` | `tests/integration/tool-direct-execute-read.test.ts:269` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_relations` | `none` | `read` | `docs/tool-catalog.json#/45` | `tests/integration/tool-catalog-completeness.test.ts:190` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_staff` | `none` | `read` | `docs/tool-catalog.json#/46` | `tests/semantic/semantic-tools.test.ts:1017`<br>`tests/semantic/semantic-tools.test.ts:1023`<br>`tests/semantic/semantic-tools.test.ts:1080`<br>`tests/semantic/semantic-tools.test.ts:997` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_stats` | `none` | `read` | `docs/tool-catalog.json#/47` | `tests/integration/tool-direct-execute-read.test.ts:175` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_stats_history` | `none` | `read` | `docs/tool-catalog.json#/48` | `tests/integration/tool-direct-execute-read.test.ts:196` | ✅ | — | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_stats_intelligence` | `none` | `read` | `docs/tool-catalog.json#/49` | `tests/integration/tool-direct-execute-read.test.ts:182` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_user` | `none` | `read` | `docs/tool-catalog.json#/50` | `tests/integration/tool-catalog-completeness.test.ts:215` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.list_character_collections` | `optional` | `read` | `docs/tool-catalog.json#/51` | `tests/semantic/collection-read-parity.test.ts:269` | ✅ | ◐ | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.list_collections` | `optional` | `read` | `docs/tool-catalog.json#/52` | `tests/semantic/semantic-tools.test.ts:1340` | ✅ | ◐ | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.list_operations` | `none` | `read` | `docs/tool-catalog.json#/53` | `tests/integration/mcp-tools.test.ts:245` | ✅ | — | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.list_person_collections` | `optional` | `read` | `docs/tool-catalog.json#/54` | `tests/integration/tool-direct-execute-account.test.ts:159` | ✅ | ◐ | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.list_revisions` | `none` | `read` | `docs/tool-catalog.json#/55` | `tests/integration/tool-catalog-completeness.test.ts:234` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.manage_character_collection` | `required` | `write` | `docs/tool-catalog.json#/56` | `tests/unit/auth-before-confirmation.test.ts:19`<br>`tests/unit/error-policy-regression.test.ts:151`<br>`tests/unit/writes.test.ts:234`<br>`tests/unit/writes.test.ts:257`<br>`tests/unit/writes.test.ts:321` | ✅ | — | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.manage_index` | `required` | `write` | `docs/tool-catalog.json#/57` | `tests/integration/tool-direct-execute-account.test.ts:209` | ✅ | — | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.manage_person_collection` | `required` | `write` | `docs/tool-catalog.json#/58` | `tests/integration/tool-direct-execute-account.test.ts:215` | ✅ | — | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.query_subjects` | `none` | `read` | `docs/tool-catalog.json#/59` | `tests/integration/tool-direct-execute-discovery.test.ts:78` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_calendar` | `none` | `read` | `docs/tool-catalog.json#/60` | `tests/integration/tool-direct-execute-render.test.ts:110` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_cast_card` | `optional` | `read` | `docs/tool-catalog.json#/61` | `tests/integration/tool-catalog-completeness.test.ts:349` | ✅ | ◐ | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_character_credit_integrity` | `none` | `read` | `docs/tool-catalog.json#/62` | `tests/integration/tool-direct-execute-render.test.ts:112` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_collection_backlog` | `required` | `read` | `docs/tool-catalog.json#/63` | `tests/integration/tool-direct-execute-render.test.ts:116` | ✅ | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_collection_dashboard` | `required` | `read` | `docs/tool-catalog.json#/64` | `tests/integration/tool-catalog-completeness.test.ts:366` | ✅ | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_collection_entity_consistency` | `required` | `read` | `docs/tool-catalog.json#/65` | `tests/integration/tool-direct-execute-render.test.ts:117` | ✅ | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_collection_intelligence` | `required` | `read` | `docs/tool-catalog.json#/66` | `tests/integration/tool-direct-execute-render.test.ts:118` | ✅ | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_collection_progress` | `required` | `read` | `docs/tool-catalog.json#/67` | `tests/integration/tool-catalog-completeness.test.ts:359` | ✅ | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_collection_schedule` | `required` | `read` | `docs/tool-catalog.json#/68` | `tests/integration/tool-direct-execute-render.test.ts:119` | ✅ | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_collection_series_groups` | `required` | `read` | `docs/tool-catalog.json#/69` | `tests/integration/tool-direct-execute-render.test.ts:120` | ✅ | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_episode_guide` | `none` | `read` | `docs/tool-catalog.json#/70` | `tests/integration/tool-direct-execute-render.test.ts:121` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_episode_integrity` | `none` | `read` | `docs/tool-catalog.json#/71` | `tests/integration/tool-direct-execute-render.test.ts:122` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_latest_subject_revision` | `none` | `read` | `docs/tool-catalog.json#/72` | `tests/integration/tool-direct-execute-render.test.ts:123` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_person_activity` | `none` | `read` | `docs/tool-catalog.json#/73` | `tests/integration/tool-direct-execute-render.test.ts:124` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_person_collaboration` | `none` | `read` | `docs/tool-catalog.json#/74` | `tests/integration/tool-direct-execute-render.test.ts:125` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_person_profile` | `none` | `read` | `docs/tool-catalog.json#/75` | `tests/integration/tool-direct-execute-render.test.ts:126` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_query_subjects` | `none` | `read` | `docs/tool-catalog.json#/76` | `tests/integration/tool-direct-execute-render.test.ts:127` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_revision_timeline` | `none` | `read` | `docs/tool-catalog.json#/77` | `tests/integration/tool-direct-execute-render.test.ts:128` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_search` | `none` | `read` | `docs/tool-catalog.json#/78` | `tests/integration/tool-catalog-completeness.test.ts:354` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_series_watch_order` | `none` | `read` | `docs/tool-catalog.json#/79` | `tests/integration/tool-direct-execute-render.test.ts:129` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_subject_card` | `optional` | `read` | `docs/tool-catalog.json#/80` | `tests/integration/tool-direct-execute-render.test.ts:130` | ✅ | ◐ | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_subject_cohort_aggregation` | `none` | `read` | `docs/tool-catalog.json#/81` | `tests/integration/tool-direct-execute-render.test.ts:131` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_subject_cohort_comparison` | `none` | `read` | `docs/tool-catalog.json#/82` | `tests/integration/tool-direct-execute-render.test.ts:132` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_subject_comparison` | `none` | `read` | `docs/tool-catalog.json#/83` | `tests/integration/tool-direct-execute-render.test.ts:133` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_subject_identity` | `none` | `read` | `docs/tool-catalog.json#/84` | `tests/integration/tool-direct-execute-render.test.ts:134` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_subject_index_membership` | `none` | `read` | `docs/tool-catalog.json#/85` | `tests/integration/tool-direct-execute-render.test.ts:135` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_subject_overlap` | `none` | `read` | `docs/tool-catalog.json#/86` | `tests/integration/tool-direct-execute-render.test.ts:136` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_subject_overview` | `none` | `read` | `docs/tool-catalog.json#/87` | `tests/integration/tool-direct-execute-render.test.ts:137` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_subject_stats_history` | `none` | `read` | `docs/tool-catalog.json#/88` | `tests/integration/tool-direct-execute-render.test.ts:138` | ✅ | — | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_subject_stats_intelligence` | `none` | `read` | `docs/tool-catalog.json#/89` | `tests/integration/tool-direct-execute-render.test.ts:139` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.resolve_subject_concept` | `none` | `read` | `docs/tool-catalog.json#/90` | `tests/integration/tool-direct-execute-discovery.test.ts:99` | ✅ | — | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.search_characters` | `optional` | `read` | `docs/tool-catalog.json#/91` | `tests/semantic/semantic-tools.test.ts:448`<br>`tests/semantic/semantic-tools.test.ts:451` | ✅ | ◐ | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.search_persons` | `none` | `read` | `docs/tool-catalog.json#/92` | `tests/semantic/semantic-tools.test.ts:509` | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.search_subjects` | `optional` | `read` | `docs/tool-catalog.json#/93` | `tests/integration/mcp-tools.test.ts:51`<br>`tests/standalone/discovery-command.test.ts:324` | ✅ | ◐ | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.update_collection` | `required` | `write` | `docs/tool-catalog.json#/94` | `tests/unit/audit-account.test.ts:63`<br>`tests/unit/writes.test.ts:31`<br>`tests/unit/writes.test.ts:94` | ✅ | — | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.update_episode_progress` | `required` | `write` | `docs/tool-catalog.json#/95` | `tests/semantic/semantic-tools.test.ts:1315`<br>`tests/unit/writes.test.ts:155`<br>`tests/unit/writes.test.ts:181` | ✅ | — | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |

## 认证验收任务

- [ ] 用真实 Bangumi OAuth 完成 `auth_start` → 回调 → `auth_status`。
- [ ] 用真实账号完成 `auth_list_accounts`、`auth_switch_account`，验证多账号隔离。
- [ ] 在明确确认下完成 `auth_remove_account` / `auth_disconnect`，记录回滚与审计结果。
- [ ] 用真实账号验证所有 `auth: required` 的读工具、写工具和私有 render 工具。
- [ ] 对写入/破坏性工具只使用测试账号和明确二次确认，不把 mock 成功当作线上成功。

## QQ/TIM 真人语音输入验收（2026-09-23）

- [x] 验收时机器人已登录，NapCat、AstrBot、Runner 和 OneBot 处于 READY。
- [x] 用户在机器人私聊使用 TIM 麦克风发送真人语音；脱敏投递审计记录到 1 条入站 `record`，不保留语音或聊天正文。
- [x] AstrBot 将 `record` 解析为 WAV，媒体桥把本轮受限文件路径交给 Antigravity 内置 `view_file`；固定合成探针已验证这条读取路径。
- [x] 用户确认真实 TIM 回复与语音口令完全一致：`7294`。真人结果仅保存 `user_attested` 标记，不保存口令对应的原始聊天内容。
- [ ] 后续只在语音桥、模型 CLI、AstrBot 或 OneBot 媒体处理改动后重跑；本次单次成功不代表各种口音、近音词、时长和编码都已覆盖。
- [ ] QQ 登录掉线率仍需长期观察；语音验收不代表掉线稳定性问题已解决。

说明：这项真人语音验收与上方 96 个工具逐项的 QQ 管线/TIM 客户端列相互独立；它不把 96 个工具的 QQ/TIM 覆盖数从 0/96 改成已完成。

这份清单完成前，不再把“完整工具覆盖”简称为“所有工具都真实测试过”。
