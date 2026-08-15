---
name: bangumi-assistant
description: >
  Use this skill when the user asks about Bangumi subjects (anime, books, games, music),
  daily schedules/calendar, episodes, characters, voice actors, users, collections,
  viewing progress, revisions, indices, account binding, or Bangumi image cards.
---

# Bangumi Assistant Skill

Use the Bangumi MCP tools for all current Bangumi data.
Do not rely on model memory for subject IDs, episode IDs, collection states, scores, schedules, or account data.

## Tool Selection Guidelines

1. **Prefer high-level Semantic Tools**:
   - `bangumi.search_subjects`: 搜索条目（动画、书籍、音乐、游戏、三次元影视）。根据关键词返回候选列表。已知条目 ID 时使用 `get_subject`。
   - `bangumi.get_subject`: 获取具体条目的详细资料与数据。
   - `bangumi.get_subject_stats_intelligence`: 获取官方评分直方图/收藏桶及其有版本的
     分布、均值、总体标准差和完成率；保留 evidence、formula、conflict 与 degraded state，
     不生成推荐或历史趋势。
   - `bangumi.search_characters`: 按角色姓名搜索虚拟角色（已知角色 ID 时使用 `get_character`）。
   - `bangumi.get_character`: 获取单个角色的详细资料及其参演作品和声优。
   - `bangumi.search_persons`: 按姓名/声优/制作人员搜索现实人物（已知人物 ID 时使用 `get_person`）。
   - `bangumi.get_person`: 获取现实人物（声优/监督/画师等）的详细资料及作品列表。
   - `bangumi.get_subject_cast`: 获取动画/作品的主要角色以及对应的声优 (CV) 列表。
   - `bangumi.get_calendar`: 查看 Bangumi 每日放送更新表。
   - `bangumi.get_episodes` / `bangumi.get_episode`: 获取作品章节列表或单个章节详情。
   - `bangumi.update_episode_progress`: 更新正篇播放进度，支持 `through` 模式（如看到第 N 集）。
   - `bangumi.list_collections`: 读取用户（或当前账号）的条目收藏列表（在看/看过/想看等）。
   - `bangumi.get_collection`: 查询用户（或当前账号）对某个特定条目的收藏状态。
   - `bangumi.get_my_profile` / `bangumi.get_user`: 获取当前绑定账号或指定 Bangumi 用户的基本资料。
   - `bangumi.list_revisions` / `bangumi.get_revision`: 查看编辑修订记录。

2. **Raw Operations**:
   - Use `bangumi.list_operations`, `bangumi.describe_operation` and `bangumi.call_operation` **only when no semantic tool covers the user's goal**.

3. Never construct arbitrary Bangumi API URLs manually.

## Workflow Examples

### 示例 1：搜索角色与人物

```text
用户：“找一下后藤ひとり”
Agent 动作：
bangumi.search_characters({ query: "後藤ひとり" })
-> 若存在多个候选，展示候选列表，不要随意猜测 ID。
```

### 示例 2：进度的语义化更新 (Through 模式)

```text
用户：“少女终末旅行我看到第 8 集了”
Agent 动作：
1. bangumi.search_subjects({ query: "少女终末旅行" })
   -> 确定条目 ID (226998)
2. bangumi.update_episode_progress({
     subjectId: 226998,
     target: {
       kind: "through",
       episodeNumber: 8
     },
     status: "watched"
   })
```

### 示例 3：查看个人的收藏与进度

```text
用户：“看看我在看的动画”
Agent 动作：
bangumi.list_collections({
  subjectType: "anime",
  status: "doing"
})
```

## Ambiguity & Candidate Rules

- When multiple subjects/characters/persons match a keyword search, show concise candidates and ask the user to choose. **Never guess an ID.**
- Candidate lists are lightweight to preserve LLM context. Use detail tools (`get_subject`, `get_character`, `get_person`) when detailed info is needed.

## Authentication & Safety

- Never ask the user to paste an OAuth access token into chat.
- Use `bangumi.auth_status` to check binding status.
- Follow the server-provided confirmation policy. Never bypass a required confirmation.
- Bulk actions (>20 episodes or destructive collection removals) automatically require confirmation.

## Configuration for Claude Code & Codex

Add the following to your `.mcp.json` or MCP configuration:

```json
{
  "mcpServers": {
    "bangumi": {
      "command": "node",
      "args": ["/path/to/bangumi-agent-kit/apps/mcp/dist/stdio.js"]
    }
  }
}
```
