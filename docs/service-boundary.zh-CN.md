# Conversation Agent Service 边界说明

## 当前仓库与制品策略

| 仓库 / 制品 | 用途 |
| --- | --- |
| `ZEGOCLOUD/pulse-conversation-agent` | 后续对外可见的 Pulse preview 仓库，只提供文档、manifest/checksum 和编译后的 preview 制品，不开放 runtime 源码。 |
| `ZEGOCLOUD/conversation-agent-dev-assistant` | 本仓库，面向 Codex / Cursor / Claude Code 等 AI 编程工具，帮助安装、部署、调优和排障。 |
| 客户 `.tgz` 制品 | 客户真正运行的不可变服务包，可以是 Pulse preview 包，也可以是客户专属私有包。 |

本仓库只做 AI 编程工具辅助，不承载 runtime 制品，不提供内部源码，不包含客户专属私有 workspace。

## 三个主要运行方

| 运行方 | 职责 | 不负责 |
| --- | --- | --- |
| ZEGO AI Agent 服务端 | RTC 音频、ASR、TTS、打断、AgentInstance 执行、ZEGO 回调。 | 客户业务权限、workspace prompt、客户 Web/API。 |
| Conversation Agent Service Gateway | ZEGO LLM callback、workspace/mode/action/skill 逻辑、动态上下文、观测和文本输出。 | RTC Token04、浏览器鉴权、客户业务系统授权。 |
| 客户服务端服务 | RTC Token04、Web/移动端 API、客户鉴权、runtime config、事件转发、对 Gateway 的服务端调用。 | Gateway 内部对话编排、ZEGO 媒体层。 |

## Web / 移动端边界

客户 Web 或移动端只应访问：

- 客户服务端服务。
- ZEGO Express SDK。

客户 Web 或移动端不应：

- 持有 Gateway control token。
- 直接调用 Gateway private control API。
- 生成或保存 ZEGO ServerSecret。

## 配置边界

- `conversationAgent.json` 保存 Gateway 项目级配置和 `env:NAME` 引用。
- `.env.local` 保存本地密钥。
- `workspace.json`、`modes/`、`knowledge/`、`skills/` 保存客户可编辑业务行为。
- 运行日志、状态文件、客户数据不应提交到 Git。

## Runtime Skill 和 AI 编程 Skill

| 名称 | 所在位置 | 用途 |
| --- | --- | --- |
| Runtime Skill | 客户 workspace 的 `skills/` | 运行时业务能力，被 Conversation Agent Service Gateway 编排。 |
| AI 编程 Skill | Developer Assistant 的 `skills/` | 指导 Codex/Cursor/Claude Code 安装、理解、调优和排障。 |

两者名字都可能叫 skill，但作用域不同，不能混用。
