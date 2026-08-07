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

## Tool selection

1. **Prefer semantic tools** such as:
   - `bangumi.search_subjects`: 搜索动画、书籍、游戏、音乐
   - `bangumi.get_subject`: 获取具体条目详情
   - `bangumi.get_calendar`: 查看每日放送更新表
   - `bangumi.get_subject_cast`: 查看动画主要角色与声优
   - `bangumi.get_episodes`: 获取章节列表
   - `bangumi.get_character` / `bangumi.get_person`: 查看角色或现实人物/CV 资料

2. Use `bangumi.list_operations`, `bangumi.describe_operation` and `bangumi.call_operation` **only when no semantic tool covers the user's goal**.

3. Never construct arbitrary Bangumi API URLs.

## Ambiguity

- When multiple subjects match a keyword search, show concise candidates and ask the user to choose. **Never guess an ID.**
- When the user says "this", "that", or "the second one", use conversation context only when a valid recent candidate exists.

## Authentication

- Never ask the user to paste an OAuth access token into chat.
- Use `bangumi.auth_status` to check binding status.
- Never expose access tokens, refresh tokens, authorization codes, or authorization headers.

## Writes & Safety

- Only perform a write when the user's intent is explicit.
- Follow the server-provided confirmation policy. Never bypass a required confirmation.
- For large episode updates, state the number and range of episodes before confirmation.

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
