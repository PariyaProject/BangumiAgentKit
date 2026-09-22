# BangumiAgentKit 逐项验收任务清单

> 生成自 `docs/tool-catalog.json` 与 `tests/`。这张表故意区分“结构覆盖”和“真实执行”：目录/Schema/源码引用全勾选，不代表 96 个工具都已经逐个调用过。

## 总览

- [x] 工具目录与注册表/Schema 精确一致：96/96。
- [x] 每个工具有测试源码引用：96/96。
- [ ] 每个工具都有直接 `execute` 夹具：96/96；仍有 0 项待补。
- [ ] 每个工具都有真实公开 API 证据：当前明确记录 39/96。
- [ ] 需要账号的工具完成真实 OAuth/账号验收：33 项目前不能用本地 mock 代替。
- [ ] QQ/TIM 逐工具端到端验收：当前只有 compact profile 的整体消息链证据，不把它误写成 96 个工具逐一通过。

状态说明：`✅` 已有当前证据；`◐` 有有限/间接证据；`⬜` 尚未完成；`—` 不适用。

| 工具 | Auth | Risk | 目录/Schema | 测试源引用 | 直接 execute 夹具 | 真实公开 API | 账号认证 | QQ/TIM | 下一步 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `bangumi.aggregate_subject_cohort` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.auth_disconnect` | `required` | `destructive` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.auth_list_accounts` | `none` | `read` | ✅ | ✅ | ✅ | ⬜ | — | ⬜ | 补公开 API；评估是否进入 QQ |
| `bangumi.auth_remove_account` | `required` | `destructive` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.auth_start` | `none` | `read` | ✅ | ✅ | ✅ | ⬜ | — | ⬜ | 补公开 API；评估是否进入 QQ |
| `bangumi.auth_status` | `none` | `read` | ✅ | ✅ | ✅ | ⬜ | — | ⬜ | 补公开 API；评估是否进入 QQ |
| `bangumi.auth_switch_account` | `none` | `write` | ✅ | ✅ | ✅ | ⬜ | — | ⬜ | 补公开 API；评估是否进入 QQ |
| `bangumi.call_operation` | `optional` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.compare_subject_cohorts` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.describe_operation` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.get_calendar` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.get_calendar_intelligence` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.get_character` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.get_character_collection` | `optional` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.get_character_credit_integrity` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.get_collection` | `optional` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.get_collection_backlog` | `required` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.get_collection_dashboard` | `required` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.get_collection_entity_consistency` | `required` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.get_collection_intelligence` | `required` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.get_collection_schedule` | `required` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.get_collection_series_groups` | `required` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.get_episode` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.get_episode_collections` | `required` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.get_episode_guide` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.get_episode_integrity` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.get_episodes` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.get_index` | `none` | `read` | ✅ | ✅ | ✅ | ⬜ | — | ⬜ | 补公开 API；评估是否进入 QQ |
| `bangumi.get_latest_subject_revision` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.get_my_profile` | `required` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.get_person` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.get_person_activity` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.get_person_collaboration` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.get_person_collection` | `optional` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.get_person_profile` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.get_revision` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.get_revision_intelligence` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.get_series_watch_order` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.get_subject` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.get_subject_cast` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.get_subject_comparison` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.get_subject_identity` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.get_subject_index_membership` | `none` | `read` | ✅ | ✅ | ✅ | ⬜ | — | ⬜ | 补公开 API；评估是否进入 QQ |
| `bangumi.get_subject_overlap` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.get_subject_overview` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.get_subject_relations` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.get_subject_staff` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.get_subject_stats` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.get_subject_stats_history` | `none` | `read` | ✅ | ✅ | ✅ | ⬜ | — | ⬜ | 补公开 API；评估是否进入 QQ |
| `bangumi.get_subject_stats_intelligence` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.get_user` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.list_character_collections` | `optional` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.list_collections` | `optional` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.list_operations` | `none` | `read` | ✅ | ✅ | ✅ | ⬜ | — | ⬜ | 补公开 API；评估是否进入 QQ |
| `bangumi.list_person_collections` | `optional` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.list_revisions` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.manage_character_collection` | `required` | `write` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.manage_index` | `required` | `write` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.manage_person_collection` | `required` | `write` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.query_subjects` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.render_calendar` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.render_cast_card` | `optional` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.render_character_credit_integrity` | `none` | `read` | ✅ | ✅ | ✅ | ⬜ | — | ⬜ | 补公开 API；评估是否进入 QQ |
| `bangumi.render_collection_backlog` | `required` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.render_collection_dashboard` | `required` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.render_collection_entity_consistency` | `required` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.render_collection_intelligence` | `required` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.render_collection_progress` | `required` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.render_collection_schedule` | `required` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.render_collection_series_groups` | `required` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.render_episode_guide` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.render_episode_integrity` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.render_latest_subject_revision` | `none` | `read` | ✅ | ✅ | ✅ | ⬜ | — | ⬜ | 补公开 API；评估是否进入 QQ |
| `bangumi.render_person_activity` | `none` | `read` | ✅ | ✅ | ✅ | ⬜ | — | ⬜ | 补公开 API；评估是否进入 QQ |
| `bangumi.render_person_collaboration` | `none` | `read` | ✅ | ✅ | ✅ | ⬜ | — | ⬜ | 补公开 API；评估是否进入 QQ |
| `bangumi.render_person_profile` | `none` | `read` | ✅ | ✅ | ✅ | ⬜ | — | ⬜ | 补公开 API；评估是否进入 QQ |
| `bangumi.render_query_subjects` | `none` | `read` | ✅ | ✅ | ✅ | ⬜ | — | ⬜ | 补公开 API；评估是否进入 QQ |
| `bangumi.render_revision_timeline` | `none` | `read` | ✅ | ✅ | ✅ | ⬜ | — | ⬜ | 补公开 API；评估是否进入 QQ |
| `bangumi.render_search` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.render_series_watch_order` | `none` | `read` | ✅ | ✅ | ✅ | ⬜ | — | ⬜ | 补公开 API；评估是否进入 QQ |
| `bangumi.render_subject_card` | `optional` | `read` | ✅ | ✅ | ✅ | ◐ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.render_subject_cohort_aggregation` | `none` | `read` | ✅ | ✅ | ✅ | ⬜ | — | ⬜ | 补公开 API；评估是否进入 QQ |
| `bangumi.render_subject_cohort_comparison` | `none` | `read` | ✅ | ✅ | ✅ | ⬜ | — | ⬜ | 补公开 API；评估是否进入 QQ |
| `bangumi.render_subject_comparison` | `none` | `read` | ✅ | ✅ | ✅ | ⬜ | — | ⬜ | 补公开 API；评估是否进入 QQ |
| `bangumi.render_subject_identity` | `none` | `read` | ✅ | ✅ | ✅ | ⬜ | — | ⬜ | 补公开 API；评估是否进入 QQ |
| `bangumi.render_subject_index_membership` | `none` | `read` | ✅ | ✅ | ✅ | ⬜ | — | ⬜ | 补公开 API；评估是否进入 QQ |
| `bangumi.render_subject_overlap` | `none` | `read` | ✅ | ✅ | ✅ | ⬜ | — | ⬜ | 补公开 API；评估是否进入 QQ |
| `bangumi.render_subject_overview` | `none` | `read` | ✅ | ✅ | ✅ | ⬜ | — | ⬜ | 补公开 API；评估是否进入 QQ |
| `bangumi.render_subject_stats_history` | `none` | `read` | ✅ | ✅ | ✅ | ⬜ | — | ⬜ | 补公开 API；评估是否进入 QQ |
| `bangumi.render_subject_stats_intelligence` | `none` | `read` | ✅ | ✅ | ✅ | ⬜ | — | ⬜ | 补公开 API；评估是否进入 QQ |
| `bangumi.resolve_subject_concept` | `none` | `read` | ✅ | ✅ | ✅ | ⬜ | — | ⬜ | 补公开 API；评估是否进入 QQ |
| `bangumi.search_characters` | `optional` | `read` | ✅ | ✅ | ✅ | ◐ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.search_persons` | `none` | `read` | ✅ | ✅ | ✅ | ◐ | — | ⬜ | 评估是否进入 QQ |
| `bangumi.search_subjects` | `optional` | `read` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.update_collection` | `required` | `write` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |
| `bangumi.update_episode_progress` | `required` | `write` | ✅ | ✅ | ✅ | ⬜ | ⬜ | ⬜ | 准备账号验收；评估是否进入 QQ |

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
