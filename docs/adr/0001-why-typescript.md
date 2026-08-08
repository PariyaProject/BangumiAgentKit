# 1. 选用 TypeScript Strict Mode

## 状态

已接受

## 上下文

我们需要选择一种兼具强类型、高效自动化 API 代码生成、成熟 MCP SDK 适配以及 Playwright / 模板渲染支持的主开发语言。

## 决策

选用 TypeScript (strict mode) 与 Node.js LTS 作为全栈开发语言。

## 后果

- Bangumi OpenAPI 可以无缝生成全类型 Client 与 Schema。
- MCP Server 可直接复用 TypeScript MCP SDK。
- 无需在 C++/Python/TypeScript 之间做跨语言数据桥接。
