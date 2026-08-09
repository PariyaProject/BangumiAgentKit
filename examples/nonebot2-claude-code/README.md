# NoneBot2 + Claude Code + BangumiAgentKit Integration

This example demonstrates how to integrate BangumiAgentKit with NoneBot2 (for QQ integration via NapCat/OneBot11) using Claude Code (`claude -p`) as the external LLM orchestrator.

## Architecture

```
QQ (User) <--> NapCatQQ / OneBot11 <--> NoneBot2 <--> Claude Code (`claude -p`) <--> BangumiAgentKit MCP
```

## Features

1. **Trusted Identity Injection**: NoneBot2 derives the QQ user's ID, bot instance, and group/private conversation context and injects them as trusted environment variables (`BANGUMI_MCP_PRINCIPAL_ID`, `BANGUMI_MCP_BOT_INSTANCE_ID`, `BANGUMI_MCP_CONVERSATION_ID`).
2. **Claude Session Continuity**: Preserves Claude Code conversation sessions (`--resume <session_id>`) per QQ conversation.
3. **Structured Output**: Enforces structured JSON output containing text response, artifact references (`art_xxx`), and pending confirmation IDs.
4. **Artifact Bridge**: Resolves rendered image artifacts (`art_xxx`) securely from `BANGUMI_ARTIFACT_DIR` without allowing model-generated file path traversal.
5. **Confirmation Continuation**: Handles two-turn pending action confirmations for write operations safely across QQ messages.

## Files

- `plugin.py`: NoneBot2 plugin source code.
- `config.example.py`: Configuration options.
- `response-schema.json`: JSON Schema for Claude structured output.
- `mcp.example.json`: Claude Code MCP configuration snippet.
