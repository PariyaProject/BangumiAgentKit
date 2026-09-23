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

状态说明：`✅` 已有当前证据；`◐` 表示有当前或逐工具 Schema 完全匹配的目录哈希绑定公开 QA 调用，工具成功完成，但报告没有字段级期望值/完整性断言，因此不代表完整数据覆盖；`⬜` 尚未完成；`—` 不适用匿名公开 API（账号必需的私有/写入功能由账号验收列单独跟踪；OAuth 生命周期、本地状态/历史和 operation metadata 没有公开 API 路径）。

| 工具 | Auth | Risk | 目录/Schema | 测试源引用 | 直接 execute 夹具 | 真实公开 API | 未认证只读门禁 | 账号认证 | Agent/MCP E2E | QQ 管线 E2E | TIM 客户端 | 下一步 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
未认证只读门禁列只记录缺少账号时的安全拒绝；真实 OAuth 与账号授权仍由“账号认证”列单独跟踪。写入/破坏性工具不进入该探针。
| `bangumi.aggregate_subject_cohort` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.auth_disconnect` | `required` | `destructive` | ✅ | ✅ | ✅ | — | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.auth_list_accounts` | `none` | `read` | ✅ | ✅ | ✅ | — | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.auth_remove_account` | `required` | `destructive` | ✅ | ✅ | ✅ | — | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.auth_start` | `none` | `read` | ✅ | ✅ | ✅ | — | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.auth_status` | `none` | `read` | ✅ | ✅ | ✅ | — | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.auth_switch_account` | `none` | `write` | ✅ | ✅ | ✅ | — | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.call_operation` | `optional` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.compare_subject_cohorts` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.describe_operation` | `none` | `read` | ✅ | ✅ | ✅ | — | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_calendar` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_calendar_intelligence` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_character` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_character_collection` | `optional` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_character_credit_integrity` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_collection` | `optional` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_collection_backlog` | `required` | `read` | ✅ | ✅ | ✅ | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_collection_dashboard` | `required` | `read` | ✅ | ✅ | ✅ | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_collection_entity_consistency` | `required` | `read` | ✅ | ✅ | ✅ | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_collection_intelligence` | `required` | `read` | ✅ | ✅ | ✅ | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_collection_schedule` | `required` | `read` | ✅ | ✅ | ✅ | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_collection_series_groups` | `required` | `read` | ✅ | ✅ | ✅ | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_episode` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_episode_collections` | `required` | `read` | ✅ | ✅ | ✅ | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_episode_guide` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_episode_integrity` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_episodes` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_index` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_latest_subject_revision` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_my_profile` | `required` | `read` | ✅ | ✅ | ✅ | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_person` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_person_activity` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_person_collaboration` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_person_collection` | `optional` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_person_profile` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_revision` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_revision_intelligence` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_series_watch_order` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_cast` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_comparison` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_identity` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_index_membership` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_overlap` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_overview` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_relations` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_staff` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_stats` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_stats_history` | `none` | `read` | ✅ | ✅ | ✅ | — | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_stats_intelligence` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_user` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.list_character_collections` | `optional` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.list_collections` | `optional` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.list_operations` | `none` | `read` | ✅ | ✅ | ✅ | — | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.list_person_collections` | `optional` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.list_revisions` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.manage_character_collection` | `required` | `write` | ✅ | ✅ | ✅ | — | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.manage_index` | `required` | `write` | ✅ | ✅ | ✅ | — | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.manage_person_collection` | `required` | `write` | ✅ | ✅ | ✅ | — | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.query_subjects` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_calendar` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_cast_card` | `optional` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_character_credit_integrity` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_collection_backlog` | `required` | `read` | ✅ | ✅ | ✅ | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_collection_dashboard` | `required` | `read` | ✅ | ✅ | ✅ | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_collection_entity_consistency` | `required` | `read` | ✅ | ✅ | ✅ | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_collection_intelligence` | `required` | `read` | ✅ | ✅ | ✅ | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_collection_progress` | `required` | `read` | ✅ | ✅ | ✅ | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_collection_schedule` | `required` | `read` | ✅ | ✅ | ✅ | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_collection_series_groups` | `required` | `read` | ✅ | ✅ | ✅ | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_episode_guide` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_episode_integrity` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_latest_subject_revision` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_person_activity` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_person_collaboration` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_person_profile` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_query_subjects` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_revision_timeline` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_search` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_series_watch_order` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_subject_card` | `optional` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_subject_cohort_aggregation` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_subject_cohort_comparison` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_subject_comparison` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_subject_identity` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_subject_index_membership` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_subject_overlap` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_subject_overview` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_subject_stats_history` | `none` | `read` | ✅ | ✅ | ✅ | — | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_subject_stats_intelligence` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.resolve_subject_concept` | `none` | `read` | ✅ | ✅ | ✅ | — | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.search_characters` | `optional` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.search_persons` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.search_subjects` | `optional` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.update_collection` | `required` | `write` | ✅ | ✅ | ✅ | — | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.update_episode_progress` | `required` | `write` | ✅ | ✅ | ✅ | — | — | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |

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
