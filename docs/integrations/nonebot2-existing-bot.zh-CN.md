# 把 BangumiAgentKit 接入已有 NoneBot2 + NapCat + Claude Code Bot

本文面向已经有以下链路的项目：

```text
NapCat → OneBot11 → NoneBot2 → Claude Code (`claude -p`)
```

目标是增加 Bangumi 工具，不重写你的 QQ adapter、NoneBot 应用或 LLM
orchestrator。BangumiAgentKit 的 MCP、Storage、TokenBroker 仍是独立服务端。

## 1. 构建 BangumiAgentKit

在本仓库根目录：

```bash
pnpm install
pnpm setup:local
pnpm build
pnpm run doctor
pnpm doctor:host
```

编辑 `.env.local` 中的 `BANGUMI_OAUTH_CLIENT_ID`、
`BANGUMI_OAUTH_CLIENT_SECRET` 和 `BANGUMI_OAUTH_REDIRECT_URI`。保持
`BANGUMI_DATA_DIR`、`BANGUMI_TOKEN_ENCRYPTION_KEY` 在 API、MCP、Host 之间
一致且不提交到 Git。

Renderer 可选：

```bash
pnpm renderer:install
```

## 2. 确认实际文件

本仓库提供的桥接入口在：

```text
examples/nonebot2-claude-code/bangumi_host/service.py
examples/nonebot2-claude-code/bangumi_host/adapter.py
examples/nonebot2-claude-code/bangumi_host/identity.py
examples/nonebot2-claude-code/bangumi_host/config.py
examples/nonebot2-claude-code/mcp.example.json
examples/nonebot2-claude-code/response-schema.json
examples/nonebot2-claude-code/system-prompt.md
```

`apps/mcp/dist/main.js` 是构建后的 MCP stdio entry；`apps/api/dist/main.js`
是共享 OAuth callback API。Host session 数据保存在
`<BANGUMI_DATA_DIR>/host-bridge.sqlite`，与 Bangumi domain SQLite 分开。

## 3. 配置 MCP

可以从 `mcp.example.json` 生成自己的 Claude MCP 配置。把占位的绝对路径
替换为真实路径：

```json
{
  "mcpServers": {
    "bangumi": {
      "command": "node",
      "args": ["/absolute/path/BangumiAgentKit/apps/mcp/dist/main.js"],
      "env": {
        "BANGUMI_DB_DRIVER": "sqlite",
        "BANGUMI_DATA_DIR": "/absolute/path/bangumi-agent-kit-data",
        "BANGUMI_ENV_FILE": "/absolute/path/BangumiAgentKit/.env.local"
      }
    }
  }
}
```

真实 Host 还必须为每次 MCP child 设置可信 external identity：

```text
BANGUMI_MCP_IDENTITY_PROVIDER=qq
BANGUMI_MCP_EXTERNAL_USER_ID=<QQ user id>
BANGUMI_MCP_BOT_INSTANCE_ID=qq:<bot self id>
BANGUMI_MCP_CONVERSATION_ID=qq:<bot>:private:<user>
```

群聊 conversation 必须包含 user：
`qq:<bot>:group:<group>:user:<user>`。不要设置 `prc_*`；MCP 会用
`Storage.findOrCreatePrincipal()` 解析内部 ID。Host 的一次性
`BANGUMI_MCP_CONFIRMATION_GRANT` 只能由 Host 在用户明确确认时注入。

## 4. 在已有 NoneBot matcher 中调用

把 `bangumi_host/` 放入你的 bot 包，或从应用的 Python path 引用它；在
进程生命周期内只创建一个 `ClaudeHostService`：

```python
from bangumi_host.adapter import handle_bangumi_agent_message
from bangumi_host.service import ClaudeHostService

bridge = ClaudeHostService.from_env()

async def delegate(user_id, group_id, bot_self_id, display_name, text):
    result = await handle_bangumi_agent_message(
        user_id=str(user_id),
        group_id=str(group_id) if group_id is not None else None,
        bot_self_id=str(bot_self_id),
        display_name=display_name,
        message_text=text,
        service=bridge,
    )
    return result.response.text, result.artifact_paths
```

只把你要委托的消息传给这个函数。把 `response.text` 作为普通文本发送，
把已经由 `ArtifactResolver` 校验过的 `artifact_paths` 转成 OneBot 图片。
本地路径只能留在 adapter 进程，不得写入 Claude structured output 或 QQ
文本。

## 5. 使用示例 plugin

如果你愿意让示例处理器接管明确命令，可加载：

```text
examples/nonebot2-claude-code/plugin.py
```

它只注册 `/bangumi`、`/bgm`、`/邦奇`，不注册 priority-1 catch-all matcher，
因此现有命令仍由你的 NoneBot 应用处理。更复杂的 bot 应保留自己的 matcher，
只调用上面的 adapter。

## 6. Claude 和依赖

示例 Host 使用本地 `claude -p`，需要操作员自行登录 Claude Code。Python
桥接的核心模块只用 stdlib；如果使用示例 OneBot adapter，在你已有的
NoneBot 环境中安装兼容版本：

```bash
python3 -m pip install 'nonebot2>=2.4,<3' 'nonebot-adapter-onebot>=2.4,<3'
```

这不是 Standalone 的依赖。Host 默认只允许 `WebSearch,WebFetch` 和
`mcp__bangumi__*`，不会启用 `Bash`、`Read`、`Edit`、`Write` 或
`--dangerously-skip-permissions`。

## 7. OAuth、确认和图片

API 用相同数据目录和密钥运行：

```bash
pnpm start:api
```

用户在同一个 QQ conversation 触发 `bangumi.auth_start` 后，用浏览器访问
URL；Token 只在服务端加密存储。破坏性/bulk write 的流程是：MCP 创建
PendingAction → Host 展示摘要 → 用户明确确认 → Host 只为一次调用注入
grant → MCP 和 PendingAction 再次校验 principal、conversation、payload
hash、expiry 和单次 claim。取消或模糊回答不会执行。

Renderer 只返回 `ArtifactRef`；Host 从受信任 ArtifactStore 导出/校验 PNG，
绝不把绝对路径交给 Claude。

## 8. 验证和排错

```bash
pnpm test:host
pnpm smoke:host
pnpm build
pnpm test:integration:host-built
```

- Claude 缺失：运行 `pnpm doctor:host`，设置绝对 `CLAUDE_BIN`。
- MCP entry 缺失：先运行 `pnpm build`，检查绝对 `apps/mcp/dist/main.js`。
- OAuth 失败：确保 API、MCP、Host 的数据目录、redirect URI 和密钥一致。
- Chromium 缺失：文字路径继续工作，按需运行 `pnpm renderer:install`。
- 确认过程中 session 失效：不要手工重放 ID，重新发起原操作。
