# 配置参考

配置由 `.env.local`、`.env` 或显式 `BANGUMI_ENV_FILE` 提供。已有
`process.env` 优先级最高，配置加载不会覆盖已有值。不要把该文件提交到
Git；`pnpm setup:local` 会生成 0600 权限的模板。

## Core

| 变量                                 | 默认值                 | 说明                              |
| ------------------------------------ | ---------------------- | --------------------------------- |
| `BANGUMI_DATA_DIR`                   | `~/.bangumi-agent-kit` | SQLite、artifact 和运行数据根目录 |
| `BANGUMI_ENV_FILE`                   | 无                     | 要加载的明确 env 文件路径         |
| `BANGUMI_DB_DRIVER`                  | `sqlite`               | `sqlite` 或 `postgres`            |
| `BANGUMI_TOKEN_ENCRYPTION_KEY`       | 开发测试 fallback      | 生产必须配置至少 16 字符密钥      |
| `BANGUMI_TOKEN_ENCRYPTION_KEYS_JSON` | 无                     | 版本化 keyring JSON               |
| `BANGUMI_TOKEN_ACTIVE_KEY_VERSION`   | `v1`                   | 当前 keyring 版本                 |

## SQLite / PostgreSQL

| 变量                         | 说明                                             |
| ---------------------------- | ------------------------------------------------ |
| `BANGUMI_SQLITE_PATH`        | 覆盖 `<data-dir>/bangumi-agent-kit.sqlite`       |
| `DATABASE_URL`               | PostgreSQL 连接 URI；显式 postgres driver 时必需 |
| `BANGUMI_DB_DRIVER=postgres` | 启用 PostgreSQL Storage                          |

SQLite 文件权限为 0600，数据目录和 artifact 目录尽力设置为 0700。多个
进程可共用一个 SQLite 文件；PostgreSQL 用于跨实例部署和兼容性测试。

## OAuth

| 变量                                 | 说明                             |
| ------------------------------------ | -------------------------------- |
| `BANGUMI_OAUTH_CLIENT_ID`            | Bangumi OAuth app ID             |
| `BANGUMI_OAUTH_CLIENT_SECRET`        | Bangumi OAuth app secret；不打印 |
| `BANGUMI_OAUTH_REDIRECT_URI`         | API/Standalone callback URI      |
| `BANGUMI_OAUTH_AUTHORIZE_URL`        | 可选 authorize endpoint 覆盖     |
| `BANGUMI_OAUTH_TOKEN_URL`            | 可选 token endpoint 覆盖         |
| `BANGUMI_TOKEN_REFRESH_SKEW_SECONDS` | token 刷新提前量                 |

## Renderer / Artifact

| 变量                             | 说明                         |
| -------------------------------- | ---------------------------- |
| `BANGUMI_ARTIFACT_DIR`           | ArtifactStore 根目录         |
| `BANGUMI_ARTIFACT_TTL_MINUTES`   | artifact TTL，默认 1440 分钟 |
| `RENDERER_TIMEOUT_MS`            | 总渲染 deadline              |
| `RENDERER_MAX_OUTPUT_BYTES`      | PNG 输出上限                 |
| `RENDERER_ASSET_MAX_CONCURRENCY` | 资源解析并发上限             |

Renderer 需要安装 Chromium：`pnpm renderer:install`。没有 Chromium 不影响
文字工具和 OAuth。

## Standalone

| 变量                               | 默认值      | 说明                               |
| ---------------------------------- | ----------- | ---------------------------------- |
| `BANGUMI_PROFILE`                  | `default`   | 默认 profile；CLI `--profile` 优先 |
| `BANGUMI_STANDALONE_OAUTH_HOST`    | `127.0.0.1` | 本地 callback bind host            |
| `BANGUMI_STANDALONE_OAUTH_PORT`    | `3000`      | callback 端口；测试可用 `0`        |
| `BANGUMI_STANDALONE_OAUTH_WAIT_MS` | `120000`    | `auth login` 交互等待上限          |

Standalone 的身份固定为 `local/standalone/<profile>`，不接受内部
`prc_*` 注入。Standalone 默认 SQLite，不要求 MCP child、Claude 或 LLM。

## MCP

| 变量                             | 说明                         |
| -------------------------------- | ---------------------------- |
| `BANGUMI_MCP_IDENTITY_PROVIDER`  | 外部 provider，例如 `qq`     |
| `BANGUMI_MCP_EXTERNAL_USER_ID`   | 外部用户 ID                  |
| `BANGUMI_MCP_BOT_INSTANCE_ID`    | bot instance scope           |
| `BANGUMI_MCP_CONVERSATION_ID`    | conversation scope           |
| `BANGUMI_MCP_DISPLAY_NAME`       | 可选显示名                   |
| `BANGUMI_MCP_CONFIRMATION_GRANT` | 仅由可信 Host 为一次调用注入 |
| `BANGUMI_ALLOW_RAW_WRITES`       | 默认 false；不建议打开       |

生产 MCP 必须有可信 external identity。内部 principal compatibility path
只限显式 development/test 设置，Standalone 不使用它。

## Host / Claude

Host 变量由 [NoneBot2 integration guide](integrations/nonebot2-existing-bot.zh-CN.md)
和 `examples/nonebot2-claude-code/README.md` 维护，包括 `CLAUDE_BIN`、
`CLAUDE_TIMEOUT_SECONDS`、`BANGUMI_HOST_ALLOWED_TOOLS`、
`BANGUMI_HOST_CLAUDE_ENV_ALLOWLIST` 等。Claude 环境 allowlist 不允许 `*`、
`BANGUMI_*`、数据库 URI、OAuth secret 或 token encryption key。

## 安全原则

配置值可被进程使用，但 token、secret、OAuth code 和 encryption key 不会
进入正常 CLI 输出、MCP structured result、Claude prompt、QQ 消息或
Renderer artifact。详见 [安全文档](security.md)。
