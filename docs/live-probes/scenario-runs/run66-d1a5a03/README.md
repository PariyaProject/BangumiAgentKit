# Run 66 discovery scenario evidence

These six sanitized reports bind the G02, G03, and G14 one-tool Agent/MCP query and Renderer runs to BangumiAgentKit `d1a5a03095818c090ca7f2f9ff255753e5381f7e` and catalog SHA `3b140a83270c06e71eb7a470035a5259fc1e65d421020d03c5344f86178b3831`. They retain only allowlisted tool-call metadata, exact scenario argument field checks, and PNG MIME/dimensions; they contain no prompts, model answers, work titles, artifact IDs, image bytes, QQ/TIM data, or credentials.

The G14 query and render reports are also copied to the top-level `docs/live-probes/` naming convention so the per-tool acceptance matrix counts one current report for each changed tool. The G02 and G03 reports remain in this scenario directory so all three selected user journeys have separately auditable model/MCP and chat-card evidence. The direct ToolRegistry run for all three scenarios is `docs/live-probes/discovery-scenarios-run66-d1a5a03-2026-10-03.json`.
