# AI 安装指令：Conversation Agent Service

本文给 Codex、Cursor、Claude Code 等 AI 编程软件使用。目标是帮助开发者获取客户服务制品、初始化客户项目、启动基础服务，并说明当前达到哪一级验收。

## 0. 安全规则

- 不要让开发者在聊天中粘贴密钥。
- 不要打印、复述、总结、上传或提交 `.env.local`、`.env`、LLM API Key、ZEGO ServerSecret、control token、callback token、GitHub token、npm token。
- 需要登录或输入密钥时，运行交互式命令或给出终端命令，让开发者在本地终端输入。
- 客户服务制品目录和客户项目目录必须分开。

## 1. 确认输入

先判断开发者是否已经提供以下信息：

| 信息 | 示例 | 如果没有 |
| --- | --- | --- |
| 客户服务制品 | `conversation-agent-3.0.beta-sdk-xxx.tgz` | 询问下载 URL、私有 Release、客户专属仓库，或本地路径。 |
| 客户项目目录 | `./ca3-project` | 默认使用服务包旁边的 `./ca3-project`。 |
| 是否需要真实 ZEGO Live E2E | 是 / 否 | 默认先完成 Level 1 本地 Gateway 验收。 |

不要询问密钥明文。密钥输入应留给 `setup` 或登录命令。

## 2. 获取客户服务制品

按实际情况选择一种方式：

### 本地已有 `.tgz`

```bash
tar -xzf /path/to/conversation-agent-3.0.beta-sdk-*.tgz
cd conversation-agent-3.0.beta-sdk
```

### 私有 GitHub Release

先让开发者完成 GitHub CLI 登录：

```bash
gh auth login
```

然后按交付方提供的 release 地址或命令下载制品。

### 受控下载链接

使用交付方提供的命令下载。下载链接如果包含 token，不要把 token 写入文档或聊天摘要。

## 3. 检查本地环境

在服务包根目录运行：

```bash
node --version
npm --version
ls -la
```

需要 Node.js 20 或更高版本。当前 beta 服务包可能需要访问 npm registry 或客户 npm mirror 安装 runtime dependencies。

## 4. 初始化客户项目

在服务包根目录运行：

```bash
./bin/conversation-agent setup --project ./ca3-project
./bin/conversation-agent check --project ./ca3-project
```

`setup` 会把客户项目文件写入 `./ca3-project`。密钥应写入 `.env.local` 或客户服务端服务示例 `.env`，`conversationAgent.json` 只保存 `env:NAME` 引用。

如果 `setup` 询问 LLM API Key、ZEGO AppID、ZEGO ServerSecret、callback token 或 control token，让开发者在终端输入，不要在聊天中输入。

## 5. 启动 Level 1：本地 Gateway

```bash
./bin/conversation-agent start gateway --project ./ca3-project --daemon
./bin/conversation-agent status --project ./ca3-project
./bin/conversation-agent doctor --project ./ca3-project
```

可选基础接口检查：

```bash
./bin/conversation-agent status --project ./ca3-project --json
```

如需手动 curl Gateway API，必须按 `conversationAgent.json` 和 `.env.local` 中的认证配置携带 token；不要把 token 输出到聊天中。

Level 1 成功只代表本地 Gateway 可用，不代表真实 RTC/ASR/TTS 全链路通过。未配置 ZEGO AppID/ServerSecret 时，`doctor` 可能报告 ZEGO lifecycle 未配置；如果当前目标只是 Level 1，这属于 Level 3 前置条件缺失，不代表本地 Gateway 启动失败。

## 6. 可选启动 Level 2：客户服务端服务 + Web 验证页

如果开发者需要浏览器侧验证，继续运行：

```bash
./bin/conversation-agent start zego-service --project ./ca3-project --daemon
./bin/conversation-agent start web --project ./ca3-project --daemon
./bin/conversation-agent status --project ./ca3-project
./bin/conversation-agent doctor --project ./ca3-project
```

然后打开 Web 验证页。默认本地地址通常是：

```text
http://127.0.0.1:5188
```

检查客户服务端服务 `/health` 和 `/config/runtime` 是否可访问。

## 7. 可选完成 Level 3：真实 ZEGO Live E2E

真实 Live E2E 需要 ZEGO 可访问的公网 HTTPS Gateway 回调地址，以及正确的 ZEGO AppID、ServerSecret、ASR/TTS 配置和事件回调配置。

验证内容：

- Web 页面入房成功。
- 麦克风音频发布成功。
- 客户服务端服务创建 AgentInstance 成功。
- ZEGO ASR 产生用户字幕。
- Gateway 收到 ZEGO LLM callback。
- ZEGO TTS 播放 AI 回复。
- Web 展示字幕、mode、action、Agent 状态和延迟指标。

## 8. 最终汇报格式

完成后向开发者汇报：

```text
当前验收级别：Level 1 / Level 2 / Level 3
服务包目录：...
客户项目目录：...
已运行命令：...
通过的检查：...
未完成或需要人工处理：...
下一步建议：...
```

不要包含任何密钥、token、`.env` 内容或客户私有数据。
