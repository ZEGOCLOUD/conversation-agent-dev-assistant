# 排障指南

先确认当前停在哪一级验收，再选择排障路径。

## Level 1：本地 Gateway

运行：

```bash
./bin/conversation-agent check --project ./ca3-project
./bin/conversation-agent status --project ./ca3-project
./bin/conversation-agent doctor --project ./ca3-project
```

常见问题：

| 现象 | 检查 |
| --- | --- |
| Node 版本过低 | `node --version`，需要 Node.js 20 或更高。 |
| npm 安装失败 | 检查 npm registry、企业 npm mirror、网络代理。 |
| Gateway 端口占用 | `doctor` 和 `status` 输出；不要盲目 kill 无关进程。 |
| LLM 调用失败 | 检查 `.env.local` 是否有 API key，但不要打印密钥内容。 |

## Level 2：客户服务端服务 + Web

检查：

```bash
./bin/conversation-agent start zego-service --project ./ca3-project --daemon
./bin/conversation-agent start web --project ./ca3-project --daemon
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8080/config/runtime
```

常见问题：

| 现象 | 检查 |
| --- | --- |
| Web 页面打不开 | Web 服务是否启动，端口是否正确。 |
| `/config/runtime` 失败 | 客户服务端服务是否启动，配置路径是否正确。 |
| 创建 AgentInstance 失败 | Gateway internal base URL、control token、ZEGO AppID/Secret 是否配置。 |

## Level 3：真实 ZEGO Live E2E

真实 Live E2E 需要公网 HTTPS 回调地址和 ZEGO 控制台回调配置。

检查：

- Web 是否成功入房。
- 浏览器是否允许麦克风。
- 麦克风音频是否发布。
- 客户服务端服务是否创建 AgentInstance。
- ZEGO 回调是否能到达 Gateway。
- Gateway 是否收到 LLM callback。
- TTS 是否有供应商配置并能播放。
- Web 是否显示字幕、mode、action、Agent 状态和延迟。

## 汇报原则

排障汇报中只报告：

- 已运行命令。
- 通过/失败的检查。
- 失败原因的非敏感摘要。
- 下一步建议。

不要报告：

- `.env.local` 或 `.env` 内容。
- secret、token、API key。
- 客户私有数据。
