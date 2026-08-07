# 4. 创建独立新仓库 bangumi-agent-kit

## 状态
已接受

## 上下文
旧有的 PHP (`Bangumi-for-QQ`) 与 C++ 版本代码过度依赖 CoolQ HTTP API、过时静态前缀匹配及单文件庞大实现，难以适配现代化 AI Agent 与 OpenAPI 标准。

## 决策
不直接重构旧仓库，而是全新创建 `bangumi-agent-kit` 仓库。借鉴旧版本的交互经验，通过 `legacy-command-adapter` 提供兼容层。

## 后果
- 摆脱旧架构包袱，建立现代 TypeScript Strict 生态。
- 业务 Core 完全脱离特定 Bot 框架。
