# 3. Agent Skill 与 MCP Server 的职责分离

## 状态

已接受

## 上下文

LLM Agent 体系中，容易混淆 Agent Prompt/Skill 与底层数据接口的边界。

## 决策

- **MCP Server**: 负责提供底层真实数据查询、网络请求、凭证解密与安全的动作执行。
- **Agent Skill (`SKILL.md`)**: 仅作为按需加载的工作流说明指南，教导 Codex / Claude Code 在何种场景选择何种 MCP 工具，以及消歧与格式要求。Skill 不包含明文密钥或业务代码。

## 后果

- 架构极其安全，无法通过 Prompt 注入盗取 Server 端凭证。
- 允许不同的 Agent 客户端（Codex, Claude Code, QQ Bot）复用统一的 MCP 能力。
