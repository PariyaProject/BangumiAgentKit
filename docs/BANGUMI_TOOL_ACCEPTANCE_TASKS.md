# BangumiAgentKit 逐项验收任务清单

> 生成自 `docs/tool-catalog.json`、`tests/` 与带目录哈希的 `docs/live-probes/` 证据。每一列对应独立验收面；WebChat、MCP 调用、QQ 管线和 TIM 客户端不互相替代。

## 总览

- [x] 工具目录与注册表/Schema 精确一致：96/96。
- [x] 每个工具有测试源码引用：96/96。
- [ ] 每个工具都有直接 `execute` 夹具：96/96；仍有 0 项待补。
- [ ] 每个工具都有真实公开 API 证据：当前明确记录 59/96。
- [ ] 需要账号的工具完成真实 OAuth/账号验收：33 项目前不能用本地 mock 代替。
- [ ] 每个工具都有实际 Agent→MCP 模型调用证据：当前 37/96。
- [ ] 每个工具都有 QQ 消息管线端到端证据：当前 0/96。
- [ ] 每个工具都有 TIM 客户端端到端证据：当前 0/96。

状态说明：`✅` 已有当前证据；`◐` 有有限/间接证据；`⬜` 尚未完成；`—` 不适用（OAuth 生命周期、本地状态/历史或 operation metadata 不发公开 Bangumi HTTP 请求）。

| 工具 | Auth | Risk | 目录/Schema | 测试源引用 | 直接 execute 夹具 | 真实公开 API | 账号认证 | Agent/MCP E2E | QQ 管线 E2E | TIM 客户端 | 下一步 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `bangumi.aggregate_subject_cohort` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.auth_disconnect` | `required` | `destructive` | ✅ | ✅ | ✅ | — | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.auth_list_accounts` | `none` | `read` | ✅ | ✅ | ✅ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.auth_remove_account` | `required` | `destructive` | ✅ | ✅ | ✅ | — | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.auth_start` | `none` | `read` | ✅ | ✅ | ✅ | — | — | ⬜ | ⬜ | ⬜ | 补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.auth_status` | `none` | `read` | ✅ | ✅ | ✅ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.auth_switch_account` | `none` | `write` | ✅ | ✅ | ✅ | — | — | ⬜ | ⬜ | ⬜ | 补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.call_operation` | `optional` | `read` | ✅ | ✅ | ✅ | ◐ | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.compare_subject_cohorts` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.describe_operation` | `none` | `read` | ✅ | ✅ | ✅ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_calendar` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_calendar_intelligence` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_character` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_character_collection` | `optional` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_character_credit_integrity` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_collection` | `optional` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_collection_backlog` | `required` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_collection_dashboard` | `required` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_collection_entity_consistency` | `required` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_collection_intelligence` | `required` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_collection_schedule` | `required` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_collection_series_groups` | `required` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_episode` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ⬜ | ⬜ | 补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_episode_collections` | `required` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_episode_guide` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_episode_integrity` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_episodes` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_index` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ⬜ | ⬜ | 补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_latest_subject_revision` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_my_profile` | `required` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_person` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_person_activity` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_person_collaboration` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_person_collection` | `optional` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_person_profile` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_revision` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ⬜ | ⬜ | 补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_revision_intelligence` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_series_watch_order` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_cast` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_comparison` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_identity` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_index_membership` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ⬜ | ⬜ | 补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_overlap` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_overview` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_relations` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_staff` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_stats` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_stats_history` | `none` | `read` | ✅ | ✅ | ✅ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_subject_stats_intelligence` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.get_user` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ⬜ | ⬜ | 补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.list_character_collections` | `optional` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.list_collections` | `optional` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.list_operations` | `none` | `read` | ✅ | ✅ | ✅ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.list_person_collections` | `optional` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.list_revisions` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.manage_character_collection` | `required` | `write` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.manage_index` | `required` | `write` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.manage_person_collection` | `required` | `write` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.query_subjects` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_calendar` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ⬜ | ⬜ | 补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_cast_card` | `optional` | `read` | ✅ | ✅ | ✅ | ◐ | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_character_credit_integrity` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ⬜ | ⬜ | 补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_collection_backlog` | `required` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_collection_dashboard` | `required` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_collection_entity_consistency` | `required` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_collection_intelligence` | `required` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_collection_progress` | `required` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_collection_schedule` | `required` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_collection_series_groups` | `required` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_episode_guide` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ⬜ | ⬜ | 补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_episode_integrity` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ⬜ | ⬜ | 补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_latest_subject_revision` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ⬜ | ⬜ | 补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_person_activity` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ⬜ | ⬜ | 补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_person_collaboration` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ⬜ | ⬜ | 补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_person_profile` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ⬜ | ⬜ | 补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_query_subjects` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ⬜ | ⬜ | 补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_revision_timeline` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ⬜ | ⬜ | 补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_search` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ⬜ | ⬜ | 补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_series_watch_order` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ⬜ | ⬜ | 补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_subject_card` | `optional` | `read` | ✅ | ✅ | ✅ | ◐ | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_subject_cohort_aggregation` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ⬜ | ⬜ | 补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_subject_cohort_comparison` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ⬜ | ⬜ | 补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_subject_comparison` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ⬜ | ⬜ | 补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_subject_identity` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ⬜ | ⬜ | 补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_subject_index_membership` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ⬜ | ⬜ | 补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_subject_overlap` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ⬜ | ⬜ | 补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_subject_overview` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ⬜ | ⬜ | 补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_subject_stats_history` | `none` | `read` | ✅ | ✅ | ✅ | — | — | ⬜ | ⬜ | ⬜ | 补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.render_subject_stats_intelligence` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | ⬜ | ⬜ | 补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.resolve_subject_concept` | `none` | `read` | ✅ | ✅ | ✅ | — | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.search_characters` | `optional` | `read` | ✅ | ✅ | ✅ | ◐ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.search_persons` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ✅ | ⬜ | ⬜ | 补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.search_subjects` | `optional` | `read` | ✅ | ✅ | ✅ | ◐ | ⬜ | ✅ | ⬜ | ⬜ | 准备账号验收；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.update_collection` | `required` | `write` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |
| `bangumi.update_episode_progress` | `required` | `write` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 准备账号验收；补 Agent/MCP 实际调用证据；补 QQ 消息管线 E2E；补 TIM 客户端 E2E |

## 认证验收任务

- [ ] 用真实 Bangumi OAuth 完成 `auth_start` → 回调 → `auth_status`。
- [ ] 用真实账号完成 `auth_list_accounts`、`auth_switch_account`，验证多账号隔离。
- [ ] 在明确确认下完成 `auth_remove_account` / `auth_disconnect`，记录回滚与审计结果。
- [ ] 用真实账号验证所有 `auth: required` 的读工具、写工具和私有 render 工具。
- [ ] 对写入/破坏性工具只使用测试账号和明确二次确认，不把 mock 成功当作线上成功。

## QQ/TIM 语音输入任务

- [ ] 确认机器人账号已在 NapCat 登录并处于 `QQ_READY`。
- [ ] 在机器人**私聊**中按住 TIM 麦克风发送一条 5–10 秒普通中文语音；不要发送 WAV 文件卡片，也不要发送音乐。
- [ ] 语音内容建议固定为：`这是 Pariya 语音输入验收，请回复我听到的最后四个字：语音验收通过。`
- [ ] 检查 OneBot 入站段是 `record`，不是 `file`；检查 `pariya.read_media` 收到 `audio/wav`。
- [ ] 检查模型回答是否正确理解语音内容，并记录一次成功即可证明传输/识别路径；不同编码、长语音和长期稳定性另列观察。

这份清单完成前，不再把“完整工具覆盖”简称为“所有工具都真实测试过”。
