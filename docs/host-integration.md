# External Host Integration (NoneBot2 + Claude Code)

BangumiAgentKit v0.1 supports integration with external LLM hosts. The primary production target is:
```
NapCatQQ -> NoneBot2 -> Claude Code (`claude -p`) -> BangumiAgentKit MCP
```

## Architecture

1. **NoneBot2 Adapter**: Translates incoming QQ messages into Claude Code CLI subprocess calls (`claude -p`).
2. **Identity Propagation**: Injects trusted host identity via environment variables before spawning Claude processes:
   - `BANGUMI_MCP_PRINCIPAL_ID`: e.g. `qq:12345678`
   - `BANGUMI_MCP_BOT_INSTANCE_ID`: e.g. `qq:bot_01`
   - `BANGUMI_MCP_CONVERSATION_ID`: e.g. `qq:group:98765` or `qq:private:12345678`
3. **Claude Session Continuity**: Captures `session_id` from `claude -p --output-format json` and passes `--resume <session_id>` on subsequent turns for the same conversation.
4. **Structured Response Output**: Claude produces JSON responses formatted according to `examples/nonebot2-claude-code/response-schema.json`.
5. **Artifact Bridge**: Rendered card artifacts are returned as safe IDs (`art_xxx`). NoneBot resolves them to local absolute file paths using `BANGUMI_ARTIFACT_DIR` and regex validation (`^art_[A-Za-z0-9_-]+$`). Model-supplied file paths are strictly rejected.

## Example Code

See `examples/nonebot2-claude-code/` for complete Python implementation:
- `plugin.py`: NoneBot2 plugin helper functions and session manager.
- `config.example.py`: Environment configuration options.
- `response-schema.json`: Structured response JSON schema.
- `mcp.example.json`: Claude Code MCP configuration file.
