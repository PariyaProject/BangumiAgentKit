# Bangumi Agent Kit 架构说明文档

## 1. 架构目标

Bangumi Agent Kit 是一个面向 Codex、Claude Code、QQ Bot 及其他聊天平台的 Bangumi 能力平台。
核心理念是：**真正的能力下沉放在 MCP / Core 中，Skill 只负责教 Agent 正确使用这些能力；聊天平台通过 Platform Adapter 接入，不污染 Core 业务逻辑。**

---

## 2. 系统组件与分层架构

```text
Codex / Claude Code / ChatGPT Agent
                  │
               MCP Server
                  │
QQ 官方机器人 ───┼─── OneBot / NapCat
                  │
CLI / Web / 其他聊天平台
                  │
        Bangumi Agent Core
                  │
    ┌─────────────┼─────────────┐
    │             │             │
Bangumi API    OAuth/Auth    HTML Provider
    │             │             │
    └─────────────┼─────────────┘
                  │
         图片卡片渲染服务
```

系统的六大核心模块职责划分为：

1. **Bangumi Core (`packages/bangumi-core`)**
   - 包含 Domain Model 与业务服务（条目、章节、收藏、角色、人物、目录、编辑历史）。
   - 纯粹的业务逻辑与工作流，不依赖特定聊天平台 SDK 或 MCP 协议。

2. **OpenAPI 客户端 (`packages/bangumi-openapi`)**
   - 由上游 OpenAPI 规范自动生成的强类型 Client。
   - 维护包含所有 56 个 API Operation 的 Operation Registry。

3. **HTTP Transport (`packages/bangumi-transport`)**
   - 负责请求 User-Agent 校验、Bearer Token 注入、超时控制、退避重试、内存缓存与统一错误处理 (`BangumiError`)。

4. **MCP Server (`apps/mcp`)**
   - 提供 stdio 及 Streamable HTTP 接口。
   - 向 LLM/Agent 暴露高层语义工具（如 `bangumi.search_subjects`）以及保底的 Operation 工具 (`bangumi.call_operation`)。

5. **Bot Orchestrator (`apps/bot`)**
   - 针对非自带 LLM 的平台（如 QQ 机器人）提供自然语言意图理解、Tool Loop 编排与消歧处理。

6. **Platform Adapters (`packages/platform-*`)**
   - 将平台特定消息转化为统一的 `InboundMessage` 与 `OutboundMessage`，隔离平台协议细节。

7. **Renderer (`packages/renderer`)**
   - 消费强类型的 ViewModel，通过 Playwright / React 渲染静态 HTML 并截取为高清卡片图片。

---

## 3. 包依赖关系规则

```text
apps/*  ───>  packages/*
packages/platform-*  ───>  packages/platform-core
packages/tools  ───>  packages/bangumi-core
packages/bangumi-core  ───>  packages/bangumi-openapi & packages/bangumi-transport
packages/auth  ───>  packages/db
```

**禁止反向依赖**：

- `packages/bangumi-core` 绝对禁止依赖任何 LLM SDK 或平台 SDK（如 QQ SDK / OneBot）。
- `packages/bangumi-openapi` 必须完全由脚本自动生成，人工禁止编辑 `src/generated` 目录。
